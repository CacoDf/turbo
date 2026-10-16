// Recorre cada pantalla de la app: carga sin errores, muestra contenido y guarda una captura.
import { test, expect } from './fixture.mjs';

// Las rutas son las de VIEWS en public/js/main.js. En la Fase 1 se ajusta esta lista a las 4 pestañas.
const RUTAS = ['ahora', 'dia', 'capturar', 'foco', 'habitos', 'tareas', 'mas', 'garage', 'escudo', 'ajustes', 'rutinas', 'plata', 'animo', 'estudios', 'pareja', 'secretaria', 'metas', 'revision'];

for (const ruta of RUTAS) {
  test(`pantalla ${ruta}`, async ({ page, app }) => {
    await app.abrir(ruta);
    await expect(page.locator('#app h1, #app h2, #app h3').first()).toBeVisible();
    await page.screenshot({ path: `tests/capturas/${ruta}.png`, fullPage: true });
  });
}

test('la barra de navegación aparece y no se sale del ancho del iPhone', async ({ page, app }) => {
  await app.abrir('ahora');
  const nav = page.locator('#nav a');
  await expect(nav.first()).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(393);
});
