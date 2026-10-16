// El cron del servidor de punta a punta: calcula los avisos sin que la app se abra, los manda como
// push declarativo cifrado y no insiste si Joaquín ya abrió la app. Cada prueba usa un servidor nuevo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMundo, navegador, descifrar, chile } from './ayuda.mjs';

const MIN = 60000;
// Sin silencio de noche (desde = hasta) y con lo diario lejos de "ahora", para que la hora real no afecte la prueba.
const tranquilo = ahora => ({ sleepAt: '00:00', wakeAt: '00:00', morningAt: chile(ahora + 6 * 3600000).hm, reviewAt: chile(ahora + 6 * 3600000).hm });
const estado = (ahora, extra = {}) => ({ habits: [], routines: [], schedule: [], tasks: [], ...extra, settings: { ...tranquilo(ahora), ...(extra.settings || {}) } });

async function servidorCon(nav) {
  const w = await crearMundo();
  assert.equal((await w.req('POST', 'push/subscribe', nav.sub)).status, 200);
  return w;
}

test('fin del foco: el cron lo calcula del respaldo y manda un push declarativo cifrado, una sola vez', async () => {
  const nav = await navegador('https://push.test/k1');
  const w = await servidorCon(nav);
  try {
    const t0 = Date.now();
    await w.req('PUT', 'state', { updatedAt: t0, state: estado(t0, {
      focus: { start: t0 - MIN, endAt: t0 + 2 * MIN, plannedMin: 3 },
      tasks: [{ id: 't1', title: 'Pagar la luz', due: chile(t0).key, done: false }],
    }) });
    await w.cron(t0);
    assert.equal(w.pushes.length, 0, 'todavía no toca');
    await w.cron(t0 + 3 * MIN);
    assert.equal(w.pushes.length, 1);
    const p = w.pushes[0];
    assert.equal(p.url, 'https://push.test/k1');
    assert.equal(p.headers['content-encoding'], 'aes128gcm');
    assert.equal(p.headers.ttl, '3600');
    const msg = await descifrar(nav, p.body);
    assert.equal(msg.web_push, 8030);
    assert.equal(msg.notification.title, '🏁 ¡Tiempo!');
    assert.equal(msg.notification.navigate, 'https://turbo.test/#/foco', 'link absoluto a la app');
    assert.match(msg.notification.body, /parar/);
    assert.equal(msg.app_badge, 1, 'número del ícono: 1 tarea para hoy');
    await w.cron(t0 + 4 * MIN);
    assert.equal(w.pushes.length, 1, 'no se repite');
    assert.equal((await w.pendientes('https://push.test/k1')).messages.length, 0, 'con claves no usa el buzón viejo');
  } finally { await w.cerrar(); }
});

// Buenos días hace 25 min (ya mandado) y su segundo aviso hace 5 min. ¿Insiste?
async function insistencia({ abreLaApp }) {
  const nav = await navegador('https://push.test/k2');
  const w = await servidorCon(nav);
  try {
    const r = Date.now();
    await w.req('PUT', 'state', { updatedAt: r, state: estado(r, { settings: { morningAt: chile(r - 25 * MIN).hm } }) });
    await w.cron(r - 30 * MIN);
    await w.cron(r - 24 * MIN);
    assert.equal(w.pushes.length, 1);
    assert.equal((await descifrar(nav, w.pushes[0].body)).notification.title, '☀️ Buenos días');
    if (abreLaApp) assert.equal((await w.req('POST', 'seen')).status, 200);
    await w.cron(r - 4 * MIN);
    return Promise.all(w.pushes.map(p => descifrar(nav, p.body)));
  } finally { await w.cerrar(); }
}

test('insistencia: si no abre la app llega el segundo aviso; si la abre, no', async () => {
  const sinAbrir = await insistencia({ abreLaApp: false });
  assert.deepEqual(sinAbrir.map(m => m.notification.title), ['☀️ Buenos días', '☀️ ¿Partimos?']);
  assert.equal(sinAbrir[0].notification.tag, sinAbrir[1].notification.tag, 'el segundo reemplaza al primero en el centro de notificaciones');
  const abriendo = await insistencia({ abreLaApp: true });
  assert.deepEqual(abriendo.map(m => m.notification.title), ['☀️ Buenos días']);
});

test('Google Calendar: el cron lo lee solo cada hora y avisa de sus eventos sin abrir la app', async () => {
  const nav = await navegador('https://push.test/k3');
  const w = await servidorCon(nav);
  try {
    const r = Date.now();
    const ev = chile(r + 60 * MIN);
    const fin = chile(r + 90 * MIN);
    let lecturas = 0;
    w.externo.set('https://ics.test/mio.ics', () => {
      lecturas++;
      return new Response(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:d1', `DTSTART;TZID=America/Santiago:${ev.ics}`, `DTEND;TZID=America/Santiago:${fin.ics}`, 'SUMMARY:Dentista', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    });
    await w.req('PUT', 'state', { updatedAt: r, state: estado(r) });
    await w.req('PUT', 'calendar/import-url', { url: 'https://ics.test/mio.ics' });
    assert.equal(lecturas, 1);
    await w.cron(r);
    await w.cron(r + 46 * MIN);
    const msgs = await Promise.all(w.pushes.map(p => descifrar(nav, p.body)));
    const dentista = msgs.find(m => m.notification.title === '📅 Dentista en 15 min');
    assert.ok(dentista, msgs.map(m => m.notification.title).join(', '));
    assert.ok(dentista.notification.body.startsWith(`Parte a las ${ev.hm}.`), dentista.notification.body);
    assert.equal(lecturas, 1, 'dentro de la hora usa lo ya leído');
    await w.cron(r + 61 * MIN);
    assert.equal(lecturas, 2, 'pasada la hora, el servidor vuelve a leer Google Calendar solo');

    await w.req('PUT', 'calendar/import-url', { url: '' });
    const db = await w.mf.getD1Database('DB');
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM kv WHERE k IN ('importIcs', 'importCache')").first()).n, 0, 'desconectar borra lo leído');
  } finally { await w.cerrar(); }
});

test('alargar el foco después del aviso: el nuevo fin también avisa', async () => {
  const nav = await navegador('https://push.test/k5');
  const w = await servidorCon(nav);
  try {
    const t0 = Date.now();
    const foco = { start: t0 - MIN, endAt: t0 + 2 * MIN, plannedMin: 3 };
    await w.req('PUT', 'state', { updatedAt: t0, state: estado(t0, { focus: foco }) });
    await w.cron(t0);
    await w.cron(t0 + 3 * MIN);
    assert.equal(w.pushes.length, 1);
    await w.req('PUT', 'state', { updatedAt: t0 + 1, state: estado(t0, { focus: { ...foco, endAt: t0 + 17 * MIN, plannedMin: 18 } }) }); // "Sigo 15 min más"
    await w.cron(t0 + 4 * MIN);
    await w.cron(t0 + 18 * MIN);
    assert.equal(w.pushes.length, 2);
    assert.equal((await descifrar(nav, w.pushes[1].body)).notification.title, '🏁 ¡Tiempo!');
  } finally { await w.cerrar(); }
});

test('día mínimo y luego abre la app: no llega además un "Buenos días"', async () => {
  const nav = await navegador('https://push.test/k6');
  const w = await servidorCon(nav);
  try {
    const r = Date.now();
    const db = await w.mf.getD1Database('DB');
    await w.req('POST', 'seen');
    await db.prepare("UPDATE kv SET updated = ? WHERE k = 'lastSeen'").bind(r - 4 * 86400000).run();
    await w.req('PUT', 'state', { updatedAt: r, state: estado(r, { settings: { morningAt: chile(r - 10 * MIN).hm }, tasks: [{ id: 't', title: 'Informe', due: chile(r).key }] }) });
    await w.cron(r - 12 * MIN);
    await w.cron(r - 9 * MIN);
    assert.equal(w.pushes.length, 1);
    await w.req('POST', 'seen'); // toca el aviso y abre la app
    await w.cron(r - 8 * MIN);
    await w.cron(r + 15 * MIN);
    const titulos = (await Promise.all(w.pushes.map(p => descifrar(nav, p.body)))).map(m => m.notification.title);
    assert.deepEqual(titulos, ['🌱 Día mínimo']);
  } finally { await w.cerrar(); }
});

test('si el calendario falla, igual se mandan los avisos que tocan', async () => {
  const nav = await navegador('https://push.test/k7');
  const w = await servidorCon(nav);
  try {
    const t0 = Date.now();
    await w.req('PUT', 'state', { updatedAt: t0, state: estado(t0, { focus: { start: t0 - MIN, endAt: t0 + 2 * MIN, plannedMin: 3 } }) });
    await w.cron(t0);
    const db = await w.mf.getD1Database('DB');
    // Link de Google guardado y sin lectura reciente: el cron intenta leerlo y la lectura revienta.
    await db.prepare("INSERT INTO kv (k, v, updated) VALUES ('importIcs', ?, ?)").bind(JSON.stringify('https://ics.test/roto.ics'), t0).run();
    w.externo.set('https://ics.test/roto.ics', () => { throw new Error('Google caído'); });
    await w.cron(t0 + 3 * MIN);
    assert.equal(w.pushes.length, 1, 'el fin del foco llega igual');
  } finally { await w.cerrar(); }
});

test('día mínimo: tras 3 días sin abrir, el aviso lleva a Ahora con el modo de 2 minutos', async () => {
  const nav = await navegador('https://push.test/k4');
  const w = await servidorCon(nav);
  try {
    const r = Date.now();
    const db = await w.mf.getD1Database('DB');
    await w.req('POST', 'seen');
    await db.prepare("UPDATE kv SET updated = ? WHERE k = 'lastSeen'").bind(r - 4 * 86400000).run();
    await w.req('PUT', 'state', { updatedAt: r, state: estado(r, { settings: { morningAt: chile(r + 2 * MIN).hm } }) });
    await w.cron(r);
    await w.cron(r + 3 * MIN);
    const msg = await descifrar(nav, w.pushes[0].body);
    assert.equal(msg.notification.title, '🌱 Día mínimo');
    assert.equal(msg.notification.navigate, 'https://turbo.test/?minimo=1#/ahora');
    const j = await w.json('POST', 'seen');
    assert.ok(j.prev <= r - 4 * 86400000 + 1000, 'seen devuelve la apertura anterior');
  } finally { await w.cerrar(); }
});
