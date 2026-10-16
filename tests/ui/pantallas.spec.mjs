// Recorre cada pantalla de la app: carga sin errores, muestra contenido y guarda una captura.
import { test, expect } from './fixture.mjs';

// Las rutas son las de VIEWS en public/js/main.js: las 4 pestañas y sus subpantallas.
const RUTAS = ['ahora', 'dia', 'capturar', 'foco', 'habitos', 'tareas', 'garage', 'ajustes', 'rutinas', 'animo', 'estudios', 'revision'];
// Congeladas en la Fase 1: ya no tienen pantalla y caen en Ahora.
const CONGELADAS = ['mas', 'plata', 'pareja', 'escudo', 'metas', 'secretaria'];

for (const ruta of RUTAS) {
  test(`pantalla ${ruta}`, async ({ page, app }) => {
    await app.abrir('ahora');
    const ahora = await page.locator('#app').innerHTML();
    await app.abrir(ruta);
    // Una ruta desconocida cae en Ahora (main.js): si pasa, la vista no existe y la captura sería engañosa.
    if (ruta !== 'ahora') await expect.poll(() => page.locator('#app').innerHTML(), { message: `"${ruta}" dibuja Ahora` }).not.toBe(ahora);
    await expect(page.locator('#app h1, #app h2, #app h3').first()).toBeVisible();
    await page.screenshot({ path: `tests/capturas/${ruta}.png`, fullPage: true });
  });
}

test('la barra tiene solo 4 pestañas, en orden, y no se sale del ancho del iPhone', async ({ page, app }) => {
  await app.abrir('ahora');
  const nav = page.locator('#nav a');
  await expect(nav).toHaveCount(4);
  await expect(nav).toHaveText(['🏁Ahora', '🗓️Día', '🧠Capturar', '⏱️Foco']);
  for (const ruta of RUTAS) {
    await app.abrir(ruta);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, `${ruta} se sale del ancho`).toBeLessThanOrEqual(393);
  }
});

test('Foco sin sesión activa mantiene la barra para poder salir', async ({ page, app }) => {
  await app.abrir('foco');
  await expect(page.locator('#nav')).toBeVisible();
  await page.locator('#nav a', { hasText: 'Ahora' }).click();
  await expect(page).toHaveURL(/#\/ahora/);
});

for (const ruta of CONGELADAS) {
  test(`ruta congelada ${ruta} cae en Ahora`, async ({ page, app }) => {
    await app.abrir(ruta);
    await expect(page.locator('#nav a.on')).toHaveText(/Ahora/);
    await expect(page.getByText('Estudiar finanzas').first()).toBeVisible();
  });
}

test('Ahora y Día ya no ofrecen caminos a módulos congelados', async ({ page, app }) => {
  for (const ruta of ['ahora', 'dia', 'garage']) {
    await app.abrir(ruta);
    const destinos = await page.locator('[data-to]').evaluateAll(els => els.map(e => e.dataset.to));
    for (const d of CONGELADAS) expect(destinos, `${ruta} enlaza a ${d}`).not.toContain(d);
  }
});
