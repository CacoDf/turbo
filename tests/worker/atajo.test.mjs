// Atajo de iOS "Anotar en Turbo": anota sin abrir la app. Lo anotado sale en Google y avisa antes de que la app lo recoja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conBandeja, mensaje } from '../../src/bandeja.js';
import { crearMundo, chile } from './ayuda.mjs';

test('mensaje para Siri: corto, con día y hora si es evento', () => {
  assert.equal(mensaje([{ kind: 'evento', title: 'Ir al dentista', date: '2026-10-22', start: '15:00' }]), 'Anotado: Ir al dentista, jue 22 a las 15:00 ✅');
  assert.equal(mensaje([{ title: 'Comprar pan' }]), 'Anotado: Comprar pan ✅');
  assert.equal(mensaje([{ title: 'a' }, { title: 'b' }]), 'Anotadas 2 cosas ✅');
  assert.match(mensaje(null), /cuando abras Turbo/);
});

test('conBandeja: suma lo del Atajo al estado una sola vez (mismos ids)', () => {
  const bandeja = [{ id: 'b1', items: [
    { id: 'at1', kind: 'evento', title: 'Dentista', date: '2026-10-22', start: '15:00', end: '16:00' },
    { id: 'at2', title: 'Comprar pan', minutes: 10, due: null },
  ] }, { id: 'b2', texto: 'sin ia', items: null }];
  const s = conBandeja({ schedule: [], tasks: [] }, bandeja);
  assert.deepEqual(s.schedule.map(b => [b.id, b.date, b.start, b.src]), [['at1', '2026-10-22', '15:00', 'turbo']]);
  assert.deepEqual(s.tasks.map(t => t.id), ['at2']);
  const ya = conBandeja(s, bandeja);
  assert.equal(ya.schedule.length, 1);
  assert.equal(ya.tasks.length, 1);
});

test('Atajo con IA: queda en la bandeja, sale en Google y avisa, sin abrir la app; la app lo recoge y se limpia', async () => {
  const w = await crearMundo({ GEMINI_API_KEY: 'k' });
  const posts = [];
  const enGoogle = [];
  w.google = async req => {
    if (req.method === 'GET') return Response.json({ eventos: enGoogle });
    const b = JSON.parse(await req.text());
    posts.push(b);
    b.crear.forEach((it, i) => enGoogle.push({ gid: `g${i}`, turboId: it.id, title: it.title, dia1: it.dia, hora1: it.inicio, dia2: it.dia, hora2: it.fin }));
    return Response.json({ creados: Object.fromEntries(b.crear.map((it, i) => [it.id, `g${i}`])), borrados: [] });
  };
  try {
    const ahora = Date.now();
    const dia = chile(ahora + 2 * 86400000).key; // pasado mañana
    await w.req('PUT', 'state', { updatedAt: ahora, state: { schedule: [], tasks: [], habits: [], routines: [] } });
    await w.json('PUT', 'puente/url', { url: 'https://script.google.com/macros/s/AKfyc-x/exec' });

    assert.equal((await w.req('POST', 'shortcut/anotar', { texto: 'dentista pasado mañana a las 15' }, false)).status, 401, 'sin la clave no entra');
    w.geminiReply = { tasks: [{ title: 'Ir al dentista', area: 'personal', minutes: 60, due: dia, start: '15:00' }] };
    const r = await w.json('POST', 'shortcut/anotar', { texto: 'dentista pasado mañana a las 15' });
    assert.match(r.mensaje, /^Anotado: Ir al dentista, \S+ \d+ a las 15:00 ✅$/);

    const { items } = await w.json('GET', 'bandeja');
    assert.equal(items.length, 1);
    const ev = items[0].items[0];
    assert.match(ev.id, /^at/);
    for (let i = 0; i < 50 && !posts.length; i++) await new Promise(res => setTimeout(res, 40));
    assert.deepEqual(posts[0].crear.map(c => [c.id, c.dia, c.inicio]), [[ev.id, dia, '15:00']], 'sale en Google al tiro');

    const T = ahora + 36 * 3600000; // siempre entre 5 y 29 h antes de la cita: dentro de lo que planifica el cron
    await w.cron(T);
    await w.cron(T + 60000);
    const db = await w.mf.getD1Database('DB');
    const aviso = await db.prepare('SELECT at FROM avisos WHERE id = ?').bind(`blk-${ev.id}-${dia}`).first();
    assert.equal(chile(aviso?.at).hm, '14:45', 'avisa 15 min antes aunque la app no lo haya recogido');

    await w.req('POST', 'bandeja/listo', { ids: [items[0].id] });
    assert.deepEqual((await w.json('GET', 'bandeja')).items, []);
  } finally { await w.cerrar(); }
});

test('Atajo sin IA: guarda el texto y la app lo ordena al abrirse', async () => {
  const w = await crearMundo();
  try {
    const r = await w.json('POST', 'shortcut/anotar', { texto: 'comprar pan' });
    assert.match(r.mensaje, /cuando abras Turbo/);
    const { items } = await w.json('GET', 'bandeja');
    assert.equal(items[0].texto, 'comprar pan');
    assert.equal(items[0].items, null);
    assert.match((await w.json('POST', 'shortcut/anotar', { texto: '  ' })).mensaje, /No escuché/);
  } finally { await w.cerrar(); }
});
