// Puente con Google Calendar: funciones puras (src/puente.js) y el flujo completo contra un Google simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, paraGoogle, reconciliar, aplicarCambios, anotarEscritura } from '../../src/puente.js';
import { dayNum } from '../../src/tiempo.js';
import { crearMundo, chile } from './ayuda.mjs';

const HOY = dayNum(2026, 10, 20); // martes

// ---- Funciones puras ----

test('normalizar: eventos con hora, de todo el día, que cruzan la medianoche y de duración cero', () => {
  const r = normalizar([
    { title: 'Cálculo', dia1: '2026-10-20', hora1: '08:30', dia2: '2026-10-20', hora2: '10:00' },
    { title: 'Vacaciones', allDay: true, dia1: '2026-10-21', dia2: '2026-10-23' },
    { title: 'Carrete', dia1: '2026-10-23', hora1: '22:00', dia2: '2026-10-24', hora2: '02:00' },
    { title: 'Hasta medianoche', dia1: '2026-10-25', hora1: '22:00', dia2: '2026-10-26', hora2: '00:00' },
    { title: 'Recordatorio', dia1: '2026-10-20', hora1: '09:00', dia2: '2026-10-20', hora2: '09:00' },
    { title: 'Dentista', turboId: 'd1', gid: 'g1', dia1: '2026-10-22', hora1: '15:00', dia2: '2026-10-22', hora2: '16:00' },
    null, { title: 'roto', dia1: 'ayer' },
  ]);
  assert.deepEqual(r, [
    { title: 'Cálculo', date: '2026-10-20', start: '08:30', end: '10:00', allDay: false },
    { title: 'Vacaciones', date: '2026-10-21', allDay: true },
    { title: 'Vacaciones', date: '2026-10-22', allDay: true },
    { title: 'Carrete', date: '2026-10-23', start: '22:00', end: '23:59', allDay: false },
    { title: 'Carrete', date: '2026-10-24', start: '00:00', end: '02:00', allDay: false },
    { title: 'Hasta medianoche', date: '2026-10-25', start: '22:00', end: '23:59', allDay: false },
    { title: 'Dentista', turboId: 'd1', gid: 'g1', date: '2026-10-22', start: '15:00', end: '16:00', allDay: false },
  ]);
});

const dentista = { id: 'd1', title: 'Dentista', kind: 'otro', days: [], date: '2026-10-22', start: '15:00', end: '16:00', src: 'turbo' };

test('paraGoogle: crea lo que tiene día y hora desde hoy; no lo pasado, lo semanal ni lo ya creado; borra lo borrado en Turbo', () => {
  const state = {
    schedule: [
      dentista,
      { id: 'viejo', title: 'Ayer', date: '2026-10-19', start: '10:00', end: '11:00' },
      { id: 'clases', title: 'Clases', days: [2], start: '08:30', end: '11:30' },
      { id: 'ya', title: 'Ya está', date: '2026-10-21', start: '10:00', end: '11:00' },
    ],
    calBorrados: ['chao', 'nunca-subido'],
  };
  const r = paraGoogle({ state, mapa: { ya: 'g9', chao: 'g7' }, hoy: HOY });
  assert.deepEqual(r.crear, [{ id: 'd1', title: 'Dentista', dia: '2026-10-22', inicio: '15:00', fin: '16:00' }]);
  assert.deepEqual(r.borrar, [{ id: 'chao', gid: 'g7' }]);
  assert.deepEqual(anotarEscritura({ ya: 'g9', chao: 'g7' }, { creados: { d1: 'g10' }, borrados: ['g7'] }, r.borrar), { ya: 'g9', d1: 'g10' });
});

test('reconciliar: Google manda (movido o renombrado), sin duplicar en la lista de eventos', () => {
  const google = normalizar([
    { title: 'Dentista (Dr. Soto)', turboId: 'd1', gid: 'g1', dia1: '2026-10-23', hora1: '16:00', dia2: '2026-10-23', hora2: '17:00' },
    { title: 'Cálculo', dia1: '2026-10-20', hora1: '08:30', dia2: '2026-10-20', hora2: '10:00' },
  ]);
  const r = reconciliar({ state: { schedule: [dentista] }, mapa: { d1: 'g1' }, google, hoy: HOY });
  assert.deepEqual(r.cambios, [{ id: 'd1', title: 'Dentista (Dr. Soto)', date: '2026-10-23', start: '16:00', end: '17:00' }]);
  assert.deepEqual(r.eventos.map(e => e.title), ['Cálculo'], 'el de Turbo no vuelve como evento de Google');
  const s = aplicarCambios({ schedule: [dentista, { id: 'x', title: 'Otro' }] }, r.cambios);
  assert.deepEqual(s.schedule[0], { ...dentista, title: 'Dentista (Dr. Soto)', date: '2026-10-23', start: '16:00', end: '17:00' });
  assert.equal(s.schedule[1].title, 'Otro');
});

test('reconciliar: si lo borró en Google, Turbo lo borra y no lo vuelve a crear', () => {
  const r = reconciliar({ state: { schedule: [dentista] }, mapa: { d1: 'g1' }, google: [], hoy: HOY });
  assert.deepEqual(r.cambios, [{ id: 'd1', borrar: true }]);
  assert.equal(r.mapa.d1, null);
  assert.deepEqual(paraGoogle({ state: { schedule: [dentista] }, mapa: r.mapa, hoy: HOY }).crear, [], 'no se recrea');
  assert.deepEqual(aplicarCambios({ schedule: [dentista] }, r.cambios).schedule, []);
  const despues = reconciliar({ state: { schedule: [] }, mapa: r.mapa, google: [], hoy: HOY });
  assert.deepEqual(despues.mapa, {}, 'cuando la app ya lo sacó, se olvida');
});

test('reconciliar: lo que está fuera de lo leído (muy viejo) no se da por borrado', () => {
  const viejo = { ...dentista, date: '2026-09-01' };
  const r = reconciliar({ state: { schedule: [viejo] }, mapa: { d1: 'g1' }, google: [], hoy: HOY });
  assert.deepEqual(r.cambios, []);
});

test('reconciliar: un evento con marca de Turbo que el mapa no conocía se adopta (no se crea dos veces)', () => {
  const google = normalizar([{ title: 'Dentista', turboId: 'd1', gid: 'g1', dia1: '2026-10-22', hora1: '15:00', dia2: '2026-10-22', hora2: '16:00' }]);
  const r = reconciliar({ state: { schedule: [dentista] }, mapa: {}, google, hoy: HOY });
  assert.deepEqual(r.mapa, { d1: 'g1' });
  assert.deepEqual(r.cambios, []);
  assert.deepEqual(paraGoogle({ state: { schedule: [dentista] }, mapa: r.mapa, hoy: HOY }).crear, []);
});

// ---- Flujo completo: worker real (Miniflare) contra un Apps Script simulado ----

const URL_PUENTE = 'https://script.google.com/macros/s/AKfyc-prueba_123/exec';

function googleFalso(w) {
  const g = { eventos: [], posts: [], gets: 0, token: null, n: 0 };
  const auth = t => {
    if (!t || t.length < 32) return 'Falta la clave de Turbo';
    if (!g.token) g.token = t;
    return g.token === t ? null : 'Clave incorrecta';
  };
  w.google = async req => {
    const u = new URL(req.url);
    if (req.method === 'GET') {
      g.gets++;
      const e = auth(u.searchParams.get('t'));
      return Response.json(e ? { error: e } : { eventos: g.eventos.filter(x => x.dia1 >= u.searchParams.get('desde') && x.dia1 < u.searchParams.get('hasta')) });
    }
    const b = JSON.parse(await req.text());
    const e = auth(b.t);
    if (e) return Response.json({ error: e });
    g.posts.push(b);
    const creados = {};
    for (const it of b.crear) {
      const gid = `g${++g.n}`;
      g.eventos.push({ gid, title: it.title, turboId: it.id, allDay: false, dia1: it.dia, hora1: it.inicio, dia2: it.dia, hora2: it.fin });
      creados[it.id] = gid;
    }
    for (const x of b.borrar) g.eventos = g.eventos.filter(ev => ev.gid !== x.gid);
    return Response.json({ creados, borrados: b.borrar.map(x => x.gid) });
  };
  return g;
}

const esperar = async cond => { for (let i = 0; i < 50 && !cond(); i++) await new Promise(r => setTimeout(r, 40)); assert.ok(cond(), 'no pasó a tiempo'); };

test('puente de punta a punta: conectar, crear en Google al guardar, seguir lo que se mueve o borra allá', async () => {
  const w = await crearMundo();
  const g = googleFalso(w);
  try {
    const ahora = Date.now();
    const pasado = chile(ahora + 2 * 86400000).key;
    g.eventos.push({ gid: 'clase', title: 'Cálculo', allDay: false, dia1: pasado, hora1: '08:30', dia2: pasado, hora2: '10:00' });

    // Link equivocado y link bueno.
    assert.equal((await w.req('PUT', 'puente/url', { url: 'https://calendar.google.com/algo' })).status, 400);
    const con = await w.json('PUT', 'puente/url', { url: URL_PUENTE });
    assert.equal(con.ok, true);
    assert.deepEqual(con.events.map(e => e.title), ['Cálculo']);

    // Anota "dentista pasado mañana 15:00": al guardar, sale en Google sin esperar al cron.
    const d = { id: 'dent1', title: 'Dentista', kind: 'otro', days: [], date: pasado, start: '15:00', end: '16:00', src: 'turbo' };
    await w.req('PUT', 'state', { updatedAt: ahora, state: { schedule: [d], habits: [], routines: [] } });
    await esperar(() => g.posts.length === 1);
    assert.deepEqual(g.posts[0].crear, [{ id: 'dent1', title: 'Dentista', dia: pasado, inicio: '15:00', fin: '16:00' }]);
    await w.req('PUT', 'state', { updatedAt: ahora + 1, state: { schedule: [d], habits: [], routines: [] } });
    await new Promise(r => setTimeout(r, 200));
    assert.equal(g.posts.length, 1, 'guardar otra vez no lo duplica');

    // La app lo lee: Google no lo devuelve como evento aparte (no sale doble).
    let r = await w.json('GET', 'calendar/import?force');
    assert.equal(r.puente, true);
    assert.deepEqual(r.events.map(e => e.title), ['Cálculo']);
    assert.deepEqual(r.cambios, []);

    // Lo mueve en Google a las 17:00: Turbo lo sigue, y el aviso del cron también.
    Object.assign(g.eventos.find(e => e.turboId === 'dent1'), { hora1: '17:00', hora2: '18:00' });
    r = await w.json('GET', 'calendar/import?force');
    assert.deepEqual(r.cambios, [{ id: 'dent1', title: 'Dentista', date: pasado, start: '17:00', end: '18:00' }]);
    const T = ahora + 36 * 3600000; // siempre entre 5 y 29 h antes del dentista: dentro de lo que planifica el cron
    await w.cron(T); // ese minuto lee Google
    await w.cron(T + 60000); // y el siguiente planifica
    const db = await w.mf.getD1Database('DB');
    const aviso = await db.prepare('SELECT at FROM avisos WHERE id = ?').bind(`blk-dent1-${pasado}`).first();
    assert.equal(chile(aviso.at).hm, '16:45', 'avisa 15 min antes de la hora nueva');

    // El feed .ics viejo ya no lo repite.
    const { token } = await w.json('POST', 'calendar/enable', { token: 'a'.repeat(32) });
    const ics = await (await w.mf.dispatchFetch(`https://turbo.test/api/calendar/${token}.ics`)).text();
    assert.ok(!ics.includes('Dentista'), 'lo creado por el puente no sale en el .ics');

    // Lo borra en Google: Turbo también.
    g.eventos = g.eventos.filter(e => e.turboId !== 'dent1');
    r = await w.json('GET', 'calendar/import?force');
    assert.deepEqual(r.cambios, [{ id: 'dent1', borrar: true }]);
  } finally { await w.cerrar(); }
});

test('puente: lo borrado en Turbo se borra en Google', async () => {
  const w = await crearMundo();
  const g = googleFalso(w);
  try {
    const ahora = Date.now();
    const dia = chile(ahora + 86400000).key;
    await w.json('PUT', 'puente/url', { url: URL_PUENTE });
    const d = { id: 'cafe', title: 'Café con Vale', kind: 'otro', days: [], date: dia, start: '11:00', end: '12:00', src: 'turbo' };
    await w.req('PUT', 'state', { updatedAt: ahora, state: { schedule: [d] } });
    await esperar(() => g.eventos.some(e => e.turboId === 'cafe'));
    await w.req('PUT', 'state', { updatedAt: ahora + 1, state: { schedule: [], calBorrados: ['cafe'] } });
    await esperar(() => !g.eventos.some(e => e.turboId === 'cafe'));
    assert.deepEqual(g.posts.at(-1).borrar, [{ id: 'cafe', gid: 'g1' }]);
  } finally { await w.cerrar(); }
});

test('puente: si Google rechaza la clave (otro Turbo ya lo usó), conectar falla con un mensaje claro', async () => {
  const w = await crearMundo();
  const g = googleFalso(w);
  g.token = 'x'.repeat(48);
  try {
    const r = await w.req('PUT', 'puente/url', { url: URL_PUENTE });
    assert.equal(r.status, 502);
    assert.match((await r.json()).error, /Clave incorrecta/);
    const imp = await w.json('GET', 'calendar/import');
    assert.equal(imp.connected, false, 'no queda conectado a medias');
  } finally { await w.cerrar(); }
});

test('cron con puente: lee Google cada 5 min, no cada minuto', async () => {
  const w = await crearMundo();
  const g = googleFalso(w);
  try {
    const t0 = Date.now();
    await w.json('PUT', 'puente/url', { url: URL_PUENTE });
    await w.req('PUT', 'state', { updatedAt: t0, state: { schedule: [] } });
    const antes = g.gets;
    for (let m = 1; m <= 4; m++) await w.cron(t0 + m * 60000);
    assert.equal(g.gets, antes, 'recién leído: espera');
    await w.cron(t0 + 6 * 60000);
    assert.equal(g.gets, antes + 1);
  } finally { await w.cerrar(); }
});
