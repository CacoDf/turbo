// El script de respaldo contra el worker real: guarda el JSON completo y falla con mensajes claros.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportar } from '../../tools/respaldo.mjs';
import { crearMundo, SECRETO } from './ayuda.mjs';

let w, dir;
const via = (url, init) => w.mf.dispatchFetch(url, init);
before(async () => { w = await crearMundo(); dir = await mkdtemp(join(tmpdir(), 'turbo-resp-')); });
after(async () => { await w.cerrar(); await rm(dir, { recursive: true, force: true }); });

test('sin respaldo en el servidor: no guarda nada y lo explica', async () => {
  await assert.rejects(exportar({ url: 'https://turbo.test', secret: SECRETO, dir, fetchFn: via }), /no tiene respaldo/);
  assert.deepEqual(await readdir(dir), []);
});

test('clave mala: mensaje claro', async () => {
  await assert.rejects(exportar({ url: 'https://turbo.test', secret: 'mala', dir, fetchFn: via }), /clave.*no coincide/i);
});

test('dirección inválida o sin cifrar (la clave no viaja por http)', async () => {
  await assert.rejects(exportar({ url: 'turbo.test', secret: SECRETO, dir, fetchFn: via }), /https:\/\//);
  await assert.rejects(exportar({ url: 'http://turbo.tu-sitio.com', secret: SECRETO, dir, fetchFn: via }), /sin cifrar/);
});

test('con datos: escribe el JSON completo con fecha en el nombre', async () => {
  const estado = { tasks: [{ id: 't1', title: 'Estudiar' }, { id: 't2', title: 'Pagar' }], habits: [{ id: 'h1' }], game: { xp: 120 } };
  await w.req('PUT', 'state', { updatedAt: 777, state: estado });
  const r = await exportar({ url: 'https://turbo.test/', secret: SECRETO, dir, fetchFn: via, ahora: new Date(2026, 9, 20, 9, 5) });
  assert.match(r.ruta, /turbo-2026-10-20-0905\.json$/);
  assert.equal(r.tareas, 2);
  assert.ok(r.horas > 24, 'avisa la antigüedad del respaldo (updatedAt 777 es viejísimo)');
  const guardado = JSON.parse(await readFile(r.ruta, 'utf8'));
  assert.equal(guardado.updatedAt, 777);
  assert.deepEqual(guardado.state, estado);
});
