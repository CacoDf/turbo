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
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (got !== env.APP_SECRET) fail(401, 'Clave secreta incorrecta.');
}

// ---------- rutas ----------

async function api(request, env, url) {
  const path = url.pathname.slice(5); // sin "/api/"
  const method = request.method;

  // Único endpoint sin clave: el service worker pide sus mensajes usando su endpoint (que es secreto).
  if (path === 'push/pending' && method === 'GET') return pendingMessages(env, url.searchParams.get('endpoint'));

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
