// Puente con Google (Sesión 3): conectar desde Ajustes, y que Turbo siga lo que se mueve o borra en Google.
import { test, expect, KEY } from './fixture.mjs';

const URL_PUENTE = 'https://script.google.com/macros/s/AKfyc-prueba/exec';
const conServidor = async (page, app, extra = {}) => {
  await app.abrir('ahora');
  await page.evaluate(([k, extra]) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.settings = { ...(s.settings || {}), secret: 'x' };
    Object.assign(s, extra);
    localStorage.setItem(k, JSON.stringify(s));
  }, [KEY, extra]);
  await page.reload();
};

test('Ajustes: conectar el puente con la URL de Apps Script', async ({ page, app, errores }) => {
  const enviados = [];
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/puente/url', route => {
    const { url } = route.request().postDataJSON();
    enviados.push(url);
    return url.endsWith('/exec')
      ? route.fulfill({ json: { ok: true, events: [{ title: 'Cálculo', date: '2026-10-20', start: '08:30', end: '10:00', allDay: false }], cambios: [] } })
      : route.fulfill({ status: 400, json: { error: 'Ese link no es el del puente.' } });
  });
  await conServidor(page, app);
  await app.abrir('ajustes');
  await expect(page.getByText('GOOGLE CALENDAR, EN LOS DOS SENTIDOS')).toBeVisible();
  await page.getByText('Paso a paso').first().click();
  await expect(page.getByRole('button', { name: 'Copiar código' })).toBeVisible();
  await page.locator('#puenteUrl').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/capturas/ajustes-puente.png' });

  await page.locator('#puenteUrl').fill('https://calendar.google.com/x');
  await page.getByRole('button', { name: 'Conectar' }).first().click();
  await expect(page.getByText('Ese link no es el del puente.')).toBeVisible(); // el mensaje, no el JSON crudo
  errores.splice(errores.findIndex(e => /status of 400/.test(e)), 1); // ese 400 era a propósito

  await page.locator('#puenteUrl').fill(URL_PUENTE);
  await page.getByRole('button', { name: 'Conectar' }).first().click();
  await expect(page.getByText(/Conectado · 1 evento\b/)).toBeVisible();
  await expect(page.locator('#puenteUrl')).toHaveCount(0);
  expect(enviados.at(-1)).toBe(URL_PUENTE);
  const s = await app.guardado();
  expect(s.calendar.puenteOn).toBe(true);
  await page.screenshot({ path: 'tests/capturas/ajustes-puente-conectado.png' });
});

test('lo movido en Google se mueve en Turbo, y lo borrado allá desaparece de Día', async ({ page, app }) => {
  let cambios = [{ id: 'dent', title: 'Dentista', date: '2026-10-20', start: '17:00', end: '18:00' }];
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/calendar/import**', route => route.fulfill({ json: { connected: true, puente: true, events: [], cambios } }));
  await conServidor(page, app, { schedule: [{ id: 'dent', title: 'Dentista', kind: 'otro', days: [], date: '2026-10-20', start: '15:00', end: '16:00', src: 'turbo' }] });
  await app.abrir('dia');
  await page.getByRole('button', { name: 'Actualizar calendario' }).click();
  await expect(page.locator('.block', { hasText: 'Dentista' })).toContainText('17:00–18:00');
  await expect(page.locator('.block', { hasText: 'Dentista' })).toHaveCount(1);
  cambios = [{ id: 'dent', borrar: true }];
  await page.getByRole('button', { name: 'Actualizar calendario' }).click();
  await expect(page.locator('.block', { hasText: 'Dentista' })).toHaveCount(0);
  expect((await app.guardado()).schedule.some(b => b.id === 'dent')).toBe(false);
});

test('borrar en Turbo un evento con fecha lo deja anotado para borrarlo también en Google', async ({ page, app }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await conServidor(page, app, { schedule: [{ id: 'cafe', title: 'Café', kind: 'otro', days: [], date: '2026-10-21', start: '11:00', end: '12:00', src: 'turbo' }] });
  await app.abrir('dia');
  await page.getByRole('button', { name: 'Editar horario' }).click();
  await page.locator('.sched-row', { hasText: 'Café' }).getByRole('button', { name: 'Borrar' }).click();
  const s = await app.guardado();
  expect(s.schedule.some(b => b.id === 'cafe')).toBe(false);
  expect(s.calBorrados).toEqual(['cafe']);
});

test('al abrir, la app recoge lo anotado con el Atajo (con IA y sin IA) y avisa al servidor', async ({ page, app }) => {
  const listos = [];
  let bandeja = [
    { id: 'b1', texto: 'dentista jueves 15', items: [{ id: 'at1', kind: 'evento', title: 'Ir al dentista', date: '2026-10-22', start: '15:00', end: '16:00' }] },
    { id: 'b2', texto: 'comprar pan', items: null },
  ];
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/bandeja', route => route.fulfill({ json: { items: bandeja } }));
  await page.route('**/api/bandeja/listo', route => { listos.push(...route.request().postDataJSON().ids); bandeja = []; return route.fulfill({ json: { ok: true } }); });
  await conServidor(page, app);
  await expect(page.getByText('📥 Del Atajo: 2 cosas anotadas')).toBeVisible();
  const s = await app.guardado();
  expect(s.schedule.filter(b => b.id === 'at1')).toHaveLength(1);
  expect(s.tasks.some(t => /comprar pan/i.test(t.title))).toBe(true);
  expect(listos).toEqual(['b1', 'b2']);
  await page.reload();
  await expect(page.locator('#app')).not.toBeEmpty();
  expect((await app.guardado()).schedule.filter(b => b.id === 'at1')).toHaveLength(1);
});

test('si el puente se conectó desde otro aparato, Ajustes lo muestra conectado al abrir', async ({ page, app }) => {
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/calendar/import**', route => route.fulfill({ json: { connected: true, puente: true, events: [], cambios: [] } }));
  await conServidor(page, app);
  await app.abrir('ajustes');
  await expect(page.getByText(/🟢 Conectado · 0 eventos/)).toBeVisible();
  await expect(page.locator('#puenteUrl')).toHaveCount(0);
});

test('si Google no trae nada nuevo, Capturar no se redibuja: el teclado sigue abierto con lo escrito', async ({ page, app }) => {
  const ev = { title: 'Cálculo', date: '2026-10-20', start: '08:30', end: '10:00', allDay: false };
  let soltar;
  const espera = new Promise(r => (soltar = r));
  let respuesta = { connected: true, puente: true, events: [ev], cambios: [] };
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/calendar/import**', async route => { await espera; return route.fulfill({ json: respuesta }); });
  await conServidor(page, app, { extEvents: [ev], calendar: { lastImport: 0, importOn: true, puenteOn: true, lastError: null } });
  await app.abrir('capturar');
  const ta = page.locator('#capText');
  await ta.click();
  await ta.pressSequentially('comprar pan');
  await ta.evaluate(el => (el.dataset.marca = 'misma'));
  soltar(); // Google responde lo mismo de antes
  await expect.poll(async () => (await app.guardado()).calendar.lastImport).toBeGreaterThan(0);
  await page.clock.runFor(500);
  await expect(page.locator('#capText[data-marca="misma"]')).toHaveCount(1); // no se rehízo la pantalla
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('capText');
  await expect(ta).toHaveValue('comprar pan');

  // Si Google sí trae algo nuevo, se muestra (al volver a la app, sin tocar ↻).
  respuesta = { connected: true, puente: true, events: [ev, { ...ev, title: 'Ayudantía', start: '12:00', end: '13:00' }], cambios: [] };
  await page.locator('#nav a', { hasText: 'Día' }).click();
  await expect(page.getByText('Ayudantía')).toHaveCount(0);
  await page.clock.fastForward('21:00'); // pasa la espera de 20 min entre lecturas
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Ayudantía').first()).toBeVisible();
});
