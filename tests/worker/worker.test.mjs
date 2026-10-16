// Pruebas del servidor (src/worker.js) sobre workerd + D1 reales, portadas de tools/worker-test.html.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearMundo } from './ayuda.mjs';

let w;
before(async () => { w = await crearMundo(); });
after(() => w.cerrar());

const b64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const ENDPOINT = 'https://push.test/abc';

test('autenticación', async () => {
  assert.equal((await w.req('GET', 'ping', null, false)).status, 401);
  const j = await (await w.req('GET', 'ping')).json();
  assert.deepEqual(j, { ok: true, ai: false });
});

test('respaldo: guarda, lee y no pisa con versión vieja (409)', async () => {
  assert.equal((await w.req('PUT', 'state', { updatedAt: 100, state: { tasks: [1] } })).status, 200);
  const j = await w.json('GET', 'state');
  assert.equal(j.updatedAt, 100);
  assert.equal(j.state.tasks[0], 1);
  assert.equal((await w.req('PUT', 'state', { updatedAt: 50, state: {} })).status, 409);
});

test('push: clave VAPID, suscripción y cron manda solo lo que toca', async () => {
  const { key } = await w.json('GET', 'push/key');
  assert.equal(key.length, 87);
  assert.equal((await w.req('POST', 'push/subscribe', { endpoint: ENDPOINT, keys: {} })).status, 200);

  const now = Date.now();
  await w.req('PUT', 'reminders', { reminders: [
    { id: 'a', at: now - 1000, title: 'Ya toca', body: 'b1' },
    { id: 'b', at: now + 3600000, title: 'Después', body: 'b2' },
    { id: 'old', at: now - 3600000, title: 'Muy viejo', body: '' },
  ] });
  await w.cron();
  assert.equal(w.pushes.length, 1, 'el cron manda 1 push');

  const m = w.pushes[0].headers.authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m, 'header Authorization con formato vapid');
  const k = await crypto.subtle.importKey('raw', b64(m[4]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, b64(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`)), 'firma VAPID válida');
  const payload = JSON.parse(new TextDecoder().decode(b64(m[2])));
  assert.equal(m[4], key);
  assert.equal(payload.aud, 'https://push.test');
  assert.equal(payload.sub, 'https://turbo.test');

  let j = await w.pendientes(ENDPOINT);
  assert.equal(j.messages.length, 1);
  assert.equal(j.messages[0].title, 'Ya toca');
  assert.equal((await w.pendientes(ENDPOINT)).messages.length, 0, 'el buzón queda vacío');

  await w.cron();
  assert.equal(w.pushes.length, 1, 'no repite recordatorios enviados');
  await w.req('PUT', 'reminders', { reminders: [{ id: 'a', at: now - 1000, title: 'Ya toca', body: 'b1' }] });
  await w.cron();
  assert.equal(w.pushes.length, 1, 're-sincronizar no reenvía uno ya mandado');
});

test('IA: sin clave 503; con clave normaliza tareas, pasos, plan de estudio, secretaria, metas y revisión', async () => {
  assert.equal((await w.req('POST', 'ai/capture', { text: 'algo', today: 'hoy' })).status, 503);
  const ia = await crearMundo({ GEMINI_API_KEY: 'x' });
  try {
    ia.geminiReply = { tasks: [{ title: 'Estudiar finanzas', area: 'estudios', minutes: 47, due: '2026-09-25' }, { title: 'Algo raro', area: 'marte', minutes: 999, due: 'viernes' }] };
    let j = await ia.json('POST', 'ai/capture', { text: 'estudiar finanzas el viernes', today: 'hoy' });
    assert.equal(j.tasks[0].minutes, 45);
    assert.equal(j.tasks[0].due, '2026-09-25');
    assert.equal(j.tasks[1].area, 'personal');
    assert.equal(j.tasks[1].minutes, 240);
    assert.equal(j.tasks[1].due, null);

    ia.geminiReply = { steps: [{ text: 'Abrir el PDF', min: 1 }, { text: 'Leer la página 1', min: 5 }] };
    j = await ia.json('POST', 'ai/steps', { title: 'Estudiar', area: 'estudios', minutes: 30 });
    assert.equal(j.steps.length, 2);
    assert.equal(j.steps[0].text, 'Abrir el PDF');

    ia.geminiReply = { sessions: [{ title: 'Ver qué entra' }, { title: 'Estudiar unidad 3' }, { title: 'Repaso' }] };
    j = await ia.json('POST', 'ai/studyplan', { course: 'Finanzas', kind: 'prueba', title: 'P2', sessions: 3 });
    assert.deepEqual(j.sessions, ['Ver qué entra', 'Estudiar unidad 3', 'Repaso']);

    ia.geminiReply = { reply: 'Anotado', actions: [{ type: 'add_task', title: 'Pagar la luz' }, { type: 'volar', title: 'x' }] };
    j = await ia.json('POST', 'ai/assistant', { messages: [{ role: 'user', text: 'pagar la luz' }], context: { hoy: 'viernes' } });
    assert.equal(j.reply, 'Anotado');
    assert.equal(j.actions.length, 1);
    assert.equal(j.actions[0].type, 'add_task');

    ia.geminiReply = { tasks: [{ title: 'Actualizar CV', minutes: 90, day: 9 }] };
    j = await ia.json('POST', 'ai/goalweek', { goal: { title: 'Pega' } });
    assert.equal(j.tasks[0].minutes, 60);
    assert.equal(j.tasks[0].day, 6);

    ia.geminiReply = { highlights: ['a', 'b'], insight: 'i', priorities: ['1', '2', '3', '4'], message: 'm' };
    j = await ia.json('POST', 'ai/review', { stats: {}, answers: {} });
    assert.equal(j.priorities.length, 3);
    assert.equal(j.insight, 'i');
  } finally { await ia.cerrar(); }
});

test('notificación de prueba y rutas normales', async () => {
  const antes = w.pushes.length;
  const j = await w.json('POST', 'push/test');
  assert.equal(j.devices, 1);
  assert.equal(w.pushes.length, antes + 1);
  const r = await w.mf.dispatchFetch('https://turbo.test/');
  assert.equal(await r.text(), 'asset');
});

test('pareja: token propio, ánimo con notificación y desactivar', async () => {
  const T = 'a'.repeat(36);
  assert.equal((await w.share('GET', 'share/view', T)).status, 404);
  assert.equal((await w.req('POST', 'share/enable', { token: 'corto' })).status, 400);
  await w.req('POST', 'share/enable', { token: T });
  await w.req('PUT', 'share/summary', { summary: { level: 3, tasksDone: 5 } });
  assert.equal((await (await w.share('GET', 'share/view', T)).json()).summary.tasksDone, 5);
  assert.equal((await w.share('GET', 'share/view', 'b'.repeat(36))).status, 404);

  const antes = w.pushes.length;
  assert.equal((await w.share('POST', 'share/cheer', T, { from: 'Polola', msg: '¡Vamos! 💪' })).status, 200);
  assert.equal(w.pushes.length, antes + 1);
  assert.ok((await w.pendientes(ENDPOINT)).messages.some(m => m.title === '💌 Polola' && m.body === '¡Vamos! 💪'));
  const c = await w.json('GET', 'cheers');
  assert.equal(c.cheers.length, 1);
  assert.equal(c.cheers[0].from, 'Polola');
  assert.equal((await w.share('POST', 'share/cheer', T, { msg: '   ' })).status, 400);
  await w.req('POST', 'share/disable');
  assert.equal((await w.share('GET', 'share/view', T)).status, 404);
});

test('calendario: exportar .ics', async () => {
  const CAL = 'c'.repeat(36);
  assert.equal((await w.mf.dispatchFetch(`https://turbo.test/api/calendar/${CAL}.ics`)).status, 404);
  await w.req('POST', 'calendar/enable', { token: CAL });
  // Fechas relativas a hoy: el feed solo incluye tareas de hasta 7 días atrás y 60 hacia adelante.
  const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')]; };
  const [y1, m1, d1] = dia(2);
  const [y2, m2, d2] = dia(3);
  await w.req('PUT', 'state', { updatedAt: 999, state: {
    schedule: [{ id: 's1', title: 'Clases', kind: 'clase', days: [2, 3], start: '08:30', end: '11:30' }, { id: 's2', title: 'Dentista, control', kind: 'otro', days: [], date: `${y1}-${m1}-${d1}`, start: '17:00', end: '18:00' }],
    exams: [{ id: 'e1', title: 'Prueba 2', date: `${y2}-${m2}-${d2}`, courseId: 'c1' }], courses: [{ id: 'c1', name: 'Finanzas' }],
    tasks: [{ id: 't1', title: 'Pagar la luz', due: `${y1}-${m1}-${d1}`, done: false }, { id: 't2', title: 'Hecha', due: `${y1}-${m1}-${d1}`, done: true }],
  } });
  const r = await w.mf.dispatchFetch(`https://turbo.test/api/calendar/${CAL}.ics`);
  const ics = await r.text();
  assert.ok(r.headers.get('content-type').startsWith('text/calendar'));
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=TU,WE') && ics.includes('T083000'), 'clases semanales');
  assert.ok(ics.includes('SUMMARY:📌 Dentista\\, control') && ics.includes('DTSTART:' + y1 + m1 + d1 + 'T170000'), 'evento de una vez');
  assert.ok(ics.includes('📚 Prueba 2 (Finanzas)') && ics.includes('DTSTART;VALUE=DATE:' + y2 + m2 + d2), 'prueba de día completo');
  assert.ok(ics.includes('☐ Pagar la luz') && !ics.includes('Hecha'), 'solo tareas pendientes');
  const j = await w.json('POST', 'calendar/enable', { token: 'd'.repeat(36) });
  assert.equal(j.token, CAL, 'reactivar reutiliza el mismo link');
});

test('calendario: importar desde Google, memoria de 10 min y fallos', async () => {
  const hoy = new Date();
  const ymd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const mas = n => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d; };
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:a1', `DTSTART;TZID=America/Santiago:${ymd(mas(1))}T170000`, `DTEND;TZID=America/Santiago:${ymd(mas(1))}T180000`, 'SUMMARY:Dentista', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a2', `DTSTART:${ymd(mas(2))}T150000Z`, `DTEND:${ymd(mas(2))}T160000Z`, 'SUMMARY:Llamada (UTC)', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a3', `DTSTART;VALUE=DATE:${ymd(mas(3))}`, `DTEND;VALUE=DATE:${ymd(mas(4))}`, 'SUMMARY:Cumple de la polola', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a4', `DTSTART;TZID=America/Santiago:${ymd(mas(0))}T190000`, `DTEND;TZID=America/Santiago:${ymd(mas(0))}T203000`,
    'RRULE:FREQ=DAILY;COUNT=5', `EXDATE;TZID=America/Santiago:${ymd(mas(2))}T190000`, 'SUMMARY:Gym diario', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a5', `DTSTART:${ymd(mas(1))}T120000`, 'STATUS:CANCELLED', 'SUMMARY:Cancelado', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
  let lecturas = 0;
  let modo = 'ok';
  w.externo.set('https://ics.test/basic.ics', () => { lecturas++; return modo === 'ok' ? new Response(ics) : new Response('no', { status: 500 }); });

  let j = await w.json('PUT', 'calendar/import-url', { url: 'webcal://ics.test/basic.ics' });
  const de = t => j.events.filter(e => e.title === t);
  assert.deepEqual([de('Dentista')[0].start, de('Dentista')[0].end], ['17:00', '18:00']);
  assert.ok(['12:00', '11:00'].includes(de('Llamada (UTC)')[0].start), 'UTC convertido a Chile');
  assert.equal(de('Cumple de la polola')[0].allDay, true);
  assert.equal(de('Gym diario').length, 4, 'repetición diaria con fecha excluida');
  assert.equal(de('Cancelado').length, 0);

  j = await w.json('GET', 'calendar/import');
  assert.ok(j.connected && j.events.length >= 7);
  assert.equal((await w.req('PUT', 'calendar/import-url', { url: 'ftp://malo' })).status, 400);

  lecturas = 0;
  await w.req('GET', 'calendar/import');
  assert.equal(lecturas, 0, 'usa la memoria de 10 min');
  await w.req('GET', 'calendar/import?force=1');
  assert.equal(lecturas, 1, '"Actualizar ahora" fuerza la lectura');

  modo = 'falla';
  j = await w.json('GET', 'calendar/import?force=1');
  assert.ok(j.connected && j.events.length >= 7 && j.error, 'si Google falla, devuelve lo último con aviso');
});

test('calendario enorme (años de historial) se procesa rápido', async () => {
  const ymd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const big = ['BEGIN:VCALENDAR'];
  for (let i = 0; i < 4000; i++) {
    const d = new Date(2019, 0, 1 + i % 2400);
    big.push('BEGIN:VEVENT', `UID:old${i}`, `DTSTART:${ymd(d)}T150000Z`, `DTEND:${ymd(d)}T160000Z`, `SUMMARY:Viejo ${i}`, 'END:VEVENT');
  }
  for (let i = 0; i < 20; i++) big.push('BEGIN:VEVENT', `UID:rec${i}`, 'DTSTART;TZID=America/Santiago:20180105T090000', 'DTEND;TZID=America/Santiago:20180105T100000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', `SUMMARY:Semanal ${i}`, 'END:VEVENT');
  big.push('BEGIN:VEVENT', 'UID:yy', 'DTSTART;VALUE=DATE:20000101', 'RRULE:FREQ=YEARLY', 'SUMMARY:Cumple', 'END:VEVENT', 'END:VCALENDAR');
  w.externo.set('https://ics.test/big.ics', () => new Response(big.join('\r\n')));
  const t0 = performance.now();
  const j = await w.json('PUT', 'calendar/import-url', { url: 'https://ics.test/big.ics' });
  const ms = performance.now() - t0;
  assert.ok(ms < 5000, `4.000 eventos en ${ms.toFixed(0)} ms`);
  assert.ok(j.events.filter(e => e.title === 'Semanal 0').length >= 15, 'eventos semanales antiguos siguen apareciendo');
});

test('cron: las consultas usan índice (no recorren la tabla entera)', async () => {
  await w.json('GET', 'ping'); // asegura que el esquema existe
  const db = await w.mf.getD1Database('DB');
  const plan = async sql => (await db.prepare('EXPLAIN QUERY PLAN ' + sql).all()).results.map(r => r.detail).join(' | ');
  const due = await plan('SELECT * FROM reminders WHERE sent = 0 AND at <= 1');
  assert.match(due, /USING INDEX idx_reminders_due/, due);
  assert.doesNotMatch(due, /SCAN reminders/, due);
  const marcar = await plan("UPDATE reminders SET sent = 1 WHERE id = 'x'");
  assert.match(marcar, /SEARCH reminders USING (INDEX|PRIMARY KEY|COVERING INDEX) \S+/, marcar);
});
