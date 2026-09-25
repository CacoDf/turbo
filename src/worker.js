// Servidor de Turbo (Cloudflare Worker).
// - Sirve la app (carpeta public/).
// - /api/ai/*       IA con Gemini (nivel gratis).
// - /api/state      respaldo de tus datos.
// - /api/push/*     notificaciones (web push con claves VAPID generadas aquí mismo).
// - cron cada minuto: manda los recordatorios que ya tocan.
//
// Variables en Cloudflare: APP_SECRET (obligatoria), GEMINI_API_KEY (para IA), GEMINI_MODEL (opcional).

const AREAS = ['estudios', 'entreno', 'pega', 'casa', 'plata', 'personal'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      await ensureSchema(env);
      return await api(request, env, url);
    } catch (e) {
      console.error(e);
      return json({ error: e.message || 'Error' }, e.status || 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(ensureSchema(env).then(() => sendDueReminders(env)));
  },
};

// ---------- utilidades ----------

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = text => b64url(new TextEncoder().encode(text));

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  if (!env.DB) fail(500, 'Falta conectar la base de datos D1 (binding DB).');
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL, created INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, sent INTEGER NOT NULL DEFAULT 0)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL, title TEXT NOT NULL, body TEXT, tag TEXT, created INTEGER NOT NULL)'),
  ]);
  schemaReady = true;
}

async function kvGet(env, k) {
  const row = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first();
  return row ? JSON.parse(row.v) : null;
}

async function kvSet(env, k, v) {
  await env.DB.prepare('INSERT INTO kv (k, v, updated) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated = excluded.updated')
    .bind(k, JSON.stringify(v), Date.now()).run();
}

function requireAuth(request, env) {
  if (!env.APP_SECRET) fail(500, 'Falta configurar APP_SECRET en Cloudflare.');
  // Se ignoran espacios sobrantes a ambos lados (fáciles de colar al copiar/pegar).
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== env.APP_SECRET.trim()) fail(401, 'Clave secreta incorrecta.');
}

async function requireShareToken(request, env) {
  const token = request.headers.get('X-Share-Token') || '';
  const saved = await kvGet(env, 'shareToken');
  if (!saved || token !== saved) fail(404, 'Link no disponible');
}

// Mensaje de ánimo desde la página de la pareja: se guarda y llega como notificación.
async function receiveCheer(env, body) {
  const msg = String(body.msg || '').trim().slice(0, 140);
  const from = String(body.from || '').trim().slice(0, 30);
  if (!msg) fail(400, 'Mensaje vacío');
  const cheers = (await kvGet(env, 'cheers')) || [];
  const lastDay = cheers.filter(c => Date.now() - c.t < 86400000).length;
  if (lastDay >= 30) fail(429, 'Demasiados mensajes por hoy');
  cheers.unshift({ t: Date.now(), from, msg });
  await kvSet(env, 'cheers', cheers.slice(0, 100));
  await notifyAll(env, [{ title: `💌 ${from || 'Te mandaron ánimo'}`, body: msg, tag: `cheer-${Date.now()}` }]);
  return json({ ok: true });
}

// ---------- rutas ----------

async function api(request, env, url) {
  const path = url.pathname.slice(5); // sin "/api/"
  const method = request.method;

  // Endpoints sin APP_SECRET:
  // - el service worker pide sus mensajes usando su endpoint (que es secreto);
  // - la página de la pareja usa su propio token de solo lectura.
  if (path === 'push/pending' && method === 'GET') return pendingMessages(env, url.searchParams.get('endpoint'));
  if (path === 'share/view' && method === 'GET') {
    await requireShareToken(request, env);
    return json({ summary: (await kvGet(env, 'share')) || null });
  }
  if (path === 'share/cheer' && method === 'POST') {
    await requireShareToken(request, env);
    return receiveCheer(env, await request.json().catch(() => ({})));
  }
  // - el calendario (iPhone / Google) se suscribe con su propio token en la URL.
  const cal = path.match(/^calendar\/([a-f0-9]{24,64})\.ics$/);
  if (cal && method === 'GET') return calendarFeed(env, cal[1]);

  requireAuth(request, env);
  const body = ['POST', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : null;

  switch (`${method} ${path}`) {
    case 'GET ping':
      return json({ ok: true, ai: !!env.GEMINI_API_KEY });

    case 'GET state':
      return json((await kvGet(env, 'state')) || {});

    case 'PUT state': {
      const cur = await kvGet(env, 'state');
      if (cur && cur.updatedAt > body.updatedAt) return json({ error: 'Hay una versión más nueva en el servidor' }, 409);
      await kvSet(env, 'state', { updatedAt: body.updatedAt, state: body.state });
      return json({ ok: true });
    }

    case 'POST ai/capture':
      return json({ tasks: await aiCapture(env, body.text, body.today) });

    case 'POST ai/steps':
      return json({ steps: await aiSteps(env, body) });

    case 'POST ai/studyplan':
      return json({ sessions: await aiStudyPlan(env, body) });

    case 'POST share/enable': {
      if (!/^[a-f0-9]{24,64}$/.test(body?.token || '')) fail(400, 'Token inválido');
      await kvSet(env, 'shareToken', body.token);
      return json({ ok: true });
    }

    case 'POST share/disable':
      await env.DB.prepare("DELETE FROM kv WHERE k IN ('shareToken', 'share')").run();
      return json({ ok: true });

    case 'PUT share/summary':
      await kvSet(env, 'share', body.summary || null);
      return json({ ok: true });

    case 'GET cheers':
      return json({ cheers: (await kvGet(env, 'cheers')) || [] });

    case 'POST ai/assistant':
      return json(await aiAssistant(env, body));

    case 'POST ai/goalweek':
      return json({ tasks: await aiGoalWeek(env, body) });

    case 'POST ai/review':
      return json(await aiReview(env, body));

    case 'POST calendar/enable': {
      if (!/^[a-f0-9]{24,64}$/.test(body?.token || '')) fail(400, 'Token inválido');
      await kvSet(env, 'calToken', body.token);
      return json({ ok: true });
    }

    case 'PUT calendar/import-url': {
      const u = String(body?.url || '').trim().replace(/^webcal:/i, 'https:');
      if (!u) {
        await env.DB.prepare("DELETE FROM kv WHERE k = 'importIcs'").run();
        return json({ ok: true, events: [] });
      }
      if (!/^https:\/\/\S+$/.test(u)) fail(400, 'Ese link no parece válido. Debe empezar con https://');
      const events = await importCalendar(u);
      await kvSet(env, 'importIcs', u);
      return json({ ok: true, events });
    }

    case 'GET calendar/import': {
      const u = await kvGet(env, 'importIcs');
      return json({ events: u ? await importCalendar(u) : [], connected: !!u });
    }

    case 'GET push/key':
      return json({ key: (await vapidKeys(env)).publicKey });

    case 'POST push/subscribe': {
      if (!body?.endpoint) fail(400, 'Suscripción inválida');
      await env.DB.prepare('INSERT OR REPLACE INTO subs (endpoint, json, created) VALUES (?, ?, ?)').bind(body.endpoint, JSON.stringify(body), Date.now()).run();
      await kvSet(env, 'origin', url.origin);
      return json({ ok: true });
    }

    case 'POST push/test': {
      const n = await notifyAll(env, [{ title: '🏎️ Turbo', body: '¡Las notificaciones funcionan!', tag: 'test' }]);
      return json({ ok: true, devices: n });
    }

    case 'PUT reminders': {
      const list = Array.isArray(body?.reminders) ? body.reminders.slice(0, 200) : [];
      const stmts = [
        env.DB.prepare('DELETE FROM reminders WHERE sent = 0'),
        env.DB.prepare('DELETE FROM reminders WHERE at < ?').bind(Date.now() - 3 * 86400000),
        ...list.map(r => env.DB.prepare('INSERT OR IGNORE INTO reminders (id, at, title, body) VALUES (?, ?, ?, ?)').bind(String(r.id), Number(r.at), String(r.title).slice(0, 120), String(r.body || '').slice(0, 300))),
      ];
      await env.DB.batch(stmts);
      return json({ ok: true, count: list.length });
    }
  }
  fail(404, 'Ruta no encontrada');
}

// ---------- IA (Gemini) ----------

async function gemini(env, system, prompt, schema) {
  if (!env.GEMINI_API_KEY) fail(503, 'Falta GEMINI_API_KEY en Cloudflare.');
  const model = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  if (!res.ok) fail(502, `Gemini respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  try {
    return JSON.parse(text);
  } catch {
    fail(502, 'Gemini devolvió algo que no es JSON');
  }
}

const PERSONA = 'Eres el asistente de Turbo, una app para una persona con TDAH: estudiante universitario en Chile que entrena en el gimnasio. Entiendes modismos chilenos (pega = trabajo, ramo = asignatura, prueba/control/certamen = evaluación, polola = novia). Respondes siempre en español de Chile, simple y directo.';

async function aiCapture(env, text, today) {
  if (!text?.trim()) return [];
  const system = `${PERSONA}
Convierte el texto desordenado en tareas concretas.
Reglas:
- Una tarea por idea distinta. No inventes tareas que no estén en el texto.
- "title": corto, empieza con un verbo en infinitivo, sin la fecha (ej. "Estudiar para la prueba de Finanzas").
- "area": una de ${AREAS.join(', ')}.
- "minutes": estimación realista entre 5 y 240. Sé generoso: las personas con TDAH tienden a subestimar.
- "due": fecha YYYY-MM-DD si el texto menciona un día o fecha ("viernes", "mañana", "el 3"), calculada desde hoy; si no, null.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      tasks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            area: { type: 'STRING', enum: AREAS },
            minutes: { type: 'INTEGER' },
            due: { type: 'STRING', nullable: true },
          },
          required: ['title', 'area', 'minutes'],
        },
      },
    },
    required: ['tasks'],
  };
  const out = await gemini(env, system, `Hoy es: ${today}\n\nTexto:\n${text.slice(0, 4000)}`, schema);
  return (out.tasks || []).slice(0, 30).map(t => ({
    title: String(t.title).slice(0, 140),
    area: AREAS.includes(t.area) ? t.area : 'personal',
    minutes: Math.min(240, Math.max(5, Math.round(Number(t.minutes) / 5) * 5 || 25)),
    due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : null,
  }));
}

async function aiSteps(env, { title, area, minutes }) {
  const system = `${PERSONA}
Divide la tarea en pasos para alguien a quien le cuesta arrancar.
Reglas:
- Entre 3 y 7 pasos, en orden.
- El PRIMER paso debe ser ridículamente fácil y tomar 2 minutos o menos (ej. "Abrir el PDF de la materia").
- Cada paso es una acción física y visible, empieza con verbo, máximo 12 palabras.
- "min": minutos estimados del paso. La suma debe acercarse al tiempo total de la tarea.`;
  const schema = {
    type: 'OBJECT',
    properties: { steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, min: { type: 'INTEGER' } }, required: ['text', 'min'] } } },
    required: ['steps'],
  };
  const out = await gemini(env, system, `Tarea: ${String(title).slice(0, 200)}\nÁrea: ${area}\nTiempo total estimado: ${minutes} minutos`, schema);
  return (out.steps || []).slice(0, 8).map(s => ({ text: String(s.text).slice(0, 120), min: Math.max(1, Math.round(Number(s.min) || 5)) }));
}

async function aiStudyPlan(env, { course, kind, title, sessions }) {
  const n = Math.max(1, Math.min(12, Number(sessions) || 1));
  const system = `${PERSONA}
Arma un plan de estudio en sesiones de 45 minutos para una evaluación universitaria.
Reglas:
- Exactamente ${n} sesiones, en orden.
- Cada "title": qué hacer en esa sesión, concreto, empieza con verbo, máximo 10 palabras (sin el nombre del ramo).
- La primera sesión: ordenar la materia / ver qué entra. Las del medio: estudiar por partes y practicar. La última: repaso final.
- Si es una entrega o presentación, las sesiones son para avanzar el trabajo, no para estudiar.`;
  const schema = {
    type: 'OBJECT',
    properties: { sessions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' } }, required: ['title'] } } },
    required: ['sessions'],
  };
  const out = await gemini(env, system, `Ramo: ${String(course).slice(0, 80)}\nTipo: ${kind}\nEvaluación: ${String(title).slice(0, 200)}\nSesiones: ${n}`, schema);
  return (out.sessions || []).slice(0, n).map(s => String(s.title).slice(0, 100));
}

// ---------- notificaciones (web push sin contenido + buzón) ----------
// El push va vacío (no requiere cifrar contenido). Al recibirlo, el teléfono pide sus mensajes a /api/push/pending.

async function vapidKeys(env) {
  let keys = await kvGet(env, 'vapid');
  if (!keys) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    keys = {
      publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
      privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    };
    await kvSet(env, 'vapid', keys);
  }
  return keys;
}

async function vapidAuth(env, endpoint) {
  const keys = await vapidKeys(env);
  const origin = (await kvGet(env, 'origin')) || 'mailto:turbo@example.com';
  const header = b64urlText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64urlText(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: origin }));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`));
  return `vapid t=${header}.${payload}.${b64url(sig)}, k=${keys.publicKey}`;
}

async function sendPush(env, endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(env, endpoint), TTL: '86400', Urgency: 'high', 'Content-Length': '0' },
  });
  if (res.status === 404 || res.status === 410) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint),
      env.DB.prepare('DELETE FROM outbox WHERE endpoint = ?').bind(endpoint),
    ]);
  } else if (!res.ok) {
    console.warn('Push falló', res.status, await res.text());
  }
  return res.ok;
}

async function notifyAll(env, messages) {
  const { results: subs } = await env.DB.prepare('SELECT endpoint FROM subs').all();
  if (!subs.length || !messages.length) return 0;
  const now = Date.now();
  await env.DB.batch(subs.flatMap(s => messages.map(m =>
    env.DB.prepare('INSERT INTO outbox (endpoint, title, body, tag, created) VALUES (?, ?, ?, ?, ?)').bind(s.endpoint, m.title, m.body || '', m.tag || null, now))));
  await Promise.all(subs.map(s => sendPush(env, s.endpoint).catch(e => console.warn(e))));
  return subs.length;
}

async function sendDueReminders(env) {
  const now = Date.now();
  const { results: due } = await env.DB.prepare('SELECT * FROM reminders WHERE sent = 0 AND at <= ?').bind(now).all();
  if (!due.length) return;
  await env.DB.batch(due.map(r => env.DB.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').bind(r.id)));
  // Los que se atrasaron más de 30 min (p. ej. el servidor estuvo caído) se descartan.
  const fresh = due.filter(r => now - r.at < 30 * 60000);
  await notifyAll(env, fresh.map(r => ({ title: r.title, body: r.body, tag: r.id })));
}

async function pendingMessages(env, endpoint) {
  if (!endpoint) return json({ messages: [] });
  const { results } = await env.DB.prepare('SELECT id, title, body, tag FROM outbox WHERE endpoint = ? ORDER BY id').bind(endpoint).all();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM outbox WHERE endpoint = ?').bind(endpoint),
    env.DB.prepare('DELETE FROM outbox WHERE created < ?').bind(Date.now() - 86400000),
  ]);
  return json({ messages: results.map(r => ({ title: r.title, body: r.body, tag: r.tag })) });
}

// ---------- Fase 3: secretaria, metas y revisión semanal (IA) ----------

const ACTION_TYPES = ['add_task', 'complete_task', 'add_event', 'add_expense', 'add_habit', 'log_habit', 'add_exam', 'add_goal', 'mood'];
const EXPENSE_CATS = ['comida', 'delivery', 'transporte', 'salidas', 'gym', 'ropa', 'apps', 'ocio', 'u', 'casa', 'otro'];

async function aiAssistant(env, { messages = [], context = {} }) {
  const system = `${PERSONA}
Eres su secretaria personal dentro de Turbo: cálida, breve y práctica, con humor suave. Él te cuenta cosas en desorden (a veces dictadas por voz) y tú las conviertes en acciones.
Contexto actual (JSON): ${JSON.stringify(context).slice(0, 6000)}

Cómo responder:
- "reply": 1 a 3 frases cortas en español de Chile. Confirma lo que vas a anotar, o haz UNA pregunta si falta algo clave (ej. la hora de un evento). Si te cuenta algo emocional, responde con empatía antes de lo práctico.
- "actions": lo que hay que guardar. Solo lo que él dijo o pidió; no inventes. Si no hay nada que guardar, lista vacía.
Tipos de acción y campos:
- add_task: title (verbo en infinitivo), area (estudios/entreno/pega/casa/plata/personal), minutes, due (YYYY-MM-DD o null)
- complete_task: title (el de una tarea pendiente del contexto)
- add_event: title, date (YYYY-MM-DD) para algo de una vez, o days (0=dom..6=sáb) para algo que se repite cada semana; start y end (HH:MM); kind (clase/entreno/pega/otro). Si no sabe la hora de término, suma 1 hora.
- add_expense: amount (pesos chilenos, número entero; "8 lucas" = 8000), category (${EXPENSE_CATS.join('/')}), note
- add_habit: name, emoji, target (veces al día)
- log_habit: name (uno de sus hábitos del contexto), cuando dice que ya lo hizo hoy
- add_exam: course, kind (prueba/control/examen/entrega/presentacion), title, date, hours (horas de estudio estimadas)
- add_goal: title, why, deadline (YYYY-MM-DD o null)
- mood: energy (1-5), mood (1-5), cuando cuenta cómo se siente o cómo durmió
Fechas: calcula desde "hoy" del contexto. "Mañana", "el jueves", "la otra semana" → fecha exacta.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      reply: { type: 'STRING' },
      actions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            type: { type: 'STRING', enum: ACTION_TYPES },
            title: { type: 'STRING', nullable: true }, area: { type: 'STRING', nullable: true },
            minutes: { type: 'INTEGER', nullable: true }, due: { type: 'STRING', nullable: true },
            date: { type: 'STRING', nullable: true }, days: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
            start: { type: 'STRING', nullable: true }, end: { type: 'STRING', nullable: true }, kind: { type: 'STRING', nullable: true },
            amount: { type: 'INTEGER', nullable: true }, category: { type: 'STRING', nullable: true }, note: { type: 'STRING', nullable: true },
            name: { type: 'STRING', nullable: true }, emoji: { type: 'STRING', nullable: true }, target: { type: 'INTEGER', nullable: true },
            course: { type: 'STRING', nullable: true }, hours: { type: 'INTEGER', nullable: true },
            why: { type: 'STRING', nullable: true }, deadline: { type: 'STRING', nullable: true },
            energy: { type: 'INTEGER', nullable: true }, mood: { type: 'INTEGER', nullable: true },
          },
          required: ['type'],
        },
      },
    },
    required: ['reply', 'actions'],
  };
  const convo = messages.slice(-12).map(m => `${m.role === 'user' ? 'Él' : 'Tú'}: ${String(m.text).slice(0, 1500)}`).join('\n');
  const out = await gemini(env, system, convo || 'Hola', schema);
  return {
    reply: String(out.reply || '').slice(0, 600),
    actions: (out.actions || []).filter(a => ACTION_TYPES.includes(a.type)).slice(0, 15),
  };
}

async function aiGoalWeek(env, { goal, done = [], pending = [], today }) {
  const system = `${PERSONA}
Ayúdalo a avanzar en una meta personal con pasos chicos para ESTA semana.
Reglas:
- Entre 2 y 4 tareas concretas, realistas para alguien con TDAH que estudia y entrena.
- Cada "title": empieza con verbo, máximo 10 palabras, algo que se pueda hacer en una sentada.
- "minutes": entre 10 y 60. "day": día de la semana sugerido (0=dom..6=sáb), repartidas en días distintos.
- Construye sobre lo que ya hizo; no repitas lo pendiente.`;
  const schema = {
    type: 'OBJECT',
    properties: { tasks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, minutes: { type: 'INTEGER' }, day: { type: 'INTEGER' } }, required: ['title', 'minutes', 'day'] } } },
    required: ['tasks'],
  };
  const prompt = `Hoy: ${today}\nMeta: ${String(goal?.title).slice(0, 200)}\nPor qué: ${String(goal?.why || '').slice(0, 300)}\nFecha límite: ${goal?.deadline || 'sin fecha'}\nYa hizo: ${done.slice(0, 15).join('; ') || 'nada todavía'}\nPendiente: ${pending.slice(0, 10).join('; ') || 'nada'}`;
  const out = await gemini(env, system, prompt, schema);
  return (out.tasks || []).slice(0, 4).map(t => ({
    title: String(t.title).slice(0, 120),
    minutes: Math.min(60, Math.max(10, Math.round(Number(t.minutes) || 30))),
    day: Math.min(6, Math.max(0, Math.round(Number(t.day) || 1))),
  }));
}

async function aiReview(env, { stats = {}, answers = {} }) {
  const system = `${PERSONA}
Haces su revisión semanal: como un buen entrenador, honesto pero sin retar. Celebra lo logrado (aunque sea poco), nombra un patrón útil y propone foco.
- "highlights": 2 o 3 logros concretos de la semana (frases cortas).
- "insight": 1 observación útil sobre cómo funciona él (energía, horarios, qué le costó), en 1-2 frases.
- "priorities": exactamente 3 prioridades para la próxima semana, cortas y accionables.
- "message": una frase final de ánimo, con onda.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      highlights: { type: 'ARRAY', items: { type: 'STRING' } },
      insight: { type: 'STRING' },
      priorities: { type: 'ARRAY', items: { type: 'STRING' } },
      message: { type: 'STRING' },
    },
    required: ['highlights', 'insight', 'priorities', 'message'],
  };
  const out = await gemini(env, system, `Datos de la semana: ${JSON.stringify(stats).slice(0, 5000)}\nLo que salió bien (según él): ${String(answers.good || '').slice(0, 500)}\nLo que le costó: ${String(answers.hard || '').slice(0, 500)}`, schema);
  return {
    highlights: (out.highlights || []).slice(0, 3).map(String),
    insight: String(out.insight || ''),
    priorities: (out.priorities || []).slice(0, 3).map(String),
    message: String(out.message || ''),
  };
}

// ---------- Fase 3: calendario (.ics) ----------

const TZ = 'America/Santiago';
const pad = n => String(n).padStart(2, '0');
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Fecha y hora "de pared" en Chile para un instante dado.
function santiagoParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
}

// Días "de pared" como enteros (días desde 1970) para operar sin husos horarios.
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
const fromDayNum = n => { const x = new Date(n * 86400000); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() }; };
const keyOf = n => { const x = fromDayNum(n); return `${x.y}-${pad(x.m)}-${pad(x.d)}`; };
const icsDate = n => { const x = fromDayNum(n); return `${x.y}${pad(x.m)}${pad(x.d)}`; };
const keyToNum = k => { const [y, m, d] = k.split('-').map(Number); return dayNum(y, m, d); };

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Corta líneas largas (regla de .ics) sin partir emojis ni tildes a la mitad.
function fold(line) {
  const chars = Array.from(line);
  const out = [];
  for (let i = 0; i < chars.length; i += 60) out.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''));
  return out.join('\r\n');
}

async function calendarFeed(env, token) {
  const saved = await kvGet(env, 'calToken');
  if (!saved || saved !== token) fail(404, 'Calendario no disponible');
  const s = (await kvGet(env, 'state'))?.state || {};
  const now = santiagoParts();
  const today = dayNum(now.y, now.m, now.d);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const hm = t => String(t || '00:00').replace(':', '') + '00';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Turbo//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Turbo 🏎️', `X-WR-TIMEZONE:${TZ}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const event = (uid, fields) => lines.push('BEGIN:VEVENT', `UID:${uid}@turbo`, `DTSTAMP:${stamp}`, ...fields, 'END:VEVENT');
  const emoji = { clase: '🎓', entreno: '🏋️', pega: '💼', otro: '📌' };

  for (const b of s.schedule || []) {
    const title = `SUMMARY:${icsEscape(`${emoji[b.kind] || '📌'} ${b.title}`)}`;
    if (b.date) {
      const n = keyToNum(b.date);
      event(`blk-${b.id}`, [title, `DTSTART:${icsDate(n)}T${hm(b.start)}`, `DTEND:${icsDate(n)}T${hm(b.end)}`]);
    } else if (b.days?.length) {
      // Primera ocurrencia desde hace 4 semanas, y se repite cada semana.
      let n = today - 28;
      while (!b.days.includes(fromDayNum(n).dow)) n++;
      event(`blk-${b.id}`, [title, `DTSTART:${icsDate(n)}T${hm(b.start)}`, `DTEND:${icsDate(n)}T${hm(b.end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${b.days.map(d => BYDAY[d]).join(',')}`]);
    }
  }
  const courses = Object.fromEntries((s.courses || []).map(c => [c.id, c.name]));
  for (const e of s.exams || []) {
    if (!e.date) continue;
    const n = keyToNum(e.date);
    event(`exam-${e.id}`, [`SUMMARY:${icsEscape(`📚 ${e.title}${courses[e.courseId] ? ` (${courses[e.courseId]})` : ''}`)}`,
      `DTSTART;VALUE=DATE:${icsDate(n)}`, `DTEND;VALUE=DATE:${icsDate(n + 1)}`]);
  }
  for (const t of s.tasks || []) {
    if (t.done || !t.due) continue;
    const n = keyToNum(t.due);
    if (n < today - 7 || n > today + 60) continue;
    event(`task-${t.id}`, [`SUMMARY:${icsEscape(`☐ ${t.title}`)}`, `DTSTART;VALUE=DATE:${icsDate(n)}`, `DTEND;VALUE=DATE:${icsDate(n + 1)}`,
      'TRANSP:TRANSPARENT']);
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="turbo.ics"' },
  });
}

// Lee un calendario .ics (p. ej. la "dirección secreta" de Google Calendar) y devuelve
// los eventos de los próximos 21 días en hora de Chile.
async function importCalendar(url) {
  const res = await fetch(url, { headers: { Accept: 'text/calendar' } });
  if (!res.ok) fail(502, `No se pudo leer el calendario (${res.status}). Revisa que sea la dirección secreta en formato iCal.`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) fail(400, 'Ese link no es un calendario iCal (.ics).');
  return parseIcs(text);
}

function parseIcsDate(value, params = '') {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, , z] = m;
  if (!hh) return { day: dayNum(+y, +mo, +d), allDay: true, min: 0 };
  if (z) {
    const p = santiagoParts(new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi)));
    return { day: dayNum(p.y, p.m, p.d), allDay: false, min: p.hh * 60 + p.mm };
  }
  // Con TZID o sin zona: se toma como hora local (el calendario del usuario está en Chile).
  return { day: dayNum(+y, +mo, +d), allDay: false, min: +hh * 60 + +mi };
}

function parseIcs(text, from = null, to = null) {
  const now = santiagoParts();
  const start = from ?? dayNum(now.y, now.m, now.d) - 1;
  const end = to ?? start + 22;
  const raw = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of raw) {
    if (line === 'BEGIN:VEVENT') cur = { exdates: [] };
    else if (line === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(';');
      const value = line.slice(i + 1);
      const p = params.join(';');
      if (name === 'SUMMARY') cur.title = value.replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1');
      else if (name === 'DTSTART') cur.start = parseIcsDate(value, p);
      else if (name === 'DTEND') cur.end = parseIcsDate(value, p);
      else if (name === 'RRULE') cur.rrule = Object.fromEntries(value.split(';').map(kv => kv.split('=')));
      else if (name === 'EXDATE') value.split(',').forEach(v => { const x = parseIcsDate(v, p); if (x) cur.exdates.push(`${x.day}-${x.min}`); });
      else if (name === 'RECURRENCE-ID') cur.recurrenceId = parseIcsDate(value, p);
      else if (name === 'STATUS') cur.status = value;
      else if (name === 'UID') cur.uid = value;
    }
  }
  // Las ediciones de una ocurrencia (RECURRENCE-ID) reemplazan a la original.
  const overridden = new Set(events.filter(e => e.recurrenceId).map(e => `${e.uid}|${e.recurrenceId.day}-${e.recurrenceId.min}`));
  const out = [];
  const push = (e, day) => {
    if (day < start || day > end) return;
    const dur = e.end ? (e.end.day - e.start.day) * 1440 + (e.end.min - e.start.min) : e.start.allDay ? 1440 : 60;
    const endMin = Math.min(e.start.min + Math.max(dur, 0), 1439);
    out.push({
      title: e.title || '(sin título)',
      date: keyOf(day),
      allDay: e.start.allDay,
      start: e.start.allDay ? null : `${pad(Math.floor(e.start.min / 60))}:${pad(e.start.min % 60)}`,
      end: e.start.allDay ? null : `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
    });
  };
  for (const e of events) {
    if (!e.start || e.status === 'CANCELLED') continue;
    if (!e.rrule) {
      push(e, e.start.day);
      continue;
    }
    const r = e.rrule;
    const interval = Math.max(1, +r.INTERVAL || 1);
    const until = r.UNTIL ? parseIcsDate(r.UNTIL)?.day ?? Infinity : Infinity;
    const count = r.COUNT ? +r.COUNT : Infinity;
    const byday = r.BYDAY ? r.BYDAY.split(',').map(x => BYDAY.indexOf(x.slice(-2))) : null;
    const s0 = fromDayNum(e.start.day);
    const week0 = e.start.day - s0.dow;
    let n = 0;
    for (let day = e.start.day; day <= Math.min(end, until) && n < count && day < e.start.day + 3700; day++) {
      const x = fromDayNum(day);
      let hit = false;
      if (r.FREQ === 'DAILY') hit = (day - e.start.day) % interval === 0;
      else if (r.FREQ === 'WEEKLY') hit = Math.floor((day - week0) / 7) % interval === 0 && (byday ? byday.includes(x.dow) : x.dow === s0.dow);
      else if (r.FREQ === 'MONTHLY') hit = x.d === s0.d && ((x.y - s0.y) * 12 + x.m - s0.m) % interval === 0;
      else if (r.FREQ === 'YEARLY') hit = x.d === s0.d && x.m === s0.m && (x.y - s0.y) % interval === 0;
      if (!hit) continue;
      n++;
      if (e.exdates.includes(`${day}-${e.start.min}`) || overridden.has(`${e.uid}|${day}-${e.start.min}`)) continue;
      push(e, day);
    }
  }
  return out.sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''))).slice(0, 300);
}
