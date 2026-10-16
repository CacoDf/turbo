// Huecos libres (Sesión 3): Día los dibuja entre eventos y Ahora muestra el próximo.
import { test, expect, KEY } from './fixture.mjs';

// Martes 20-oct, 10:00. Clases seguidas 08:30–10:00 y 10:00–11:30, almuerzo de Google 13:00–14:00
// y un evento de todo el día (no ocupa tiempo). Huecos esperados: 11:30–13:00 y 14:00–20:00 (08:30 parte la clase).
const conDia = async (page, app) => {
  await app.abrir('ahora');
  await page.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.schedule = [
      { id: 'c1', title: 'Cálculo', kind: 'clase', days: [2], start: '08:30', end: '10:00' },
      { id: 'c2', title: 'Finanzas', kind: 'clase', days: [2], start: '10:00', end: '11:30' },
    ];
    s.extEvents = [
      { title: 'Almuerzo con Vale', date: '2026-10-20', start: '13:00', end: '14:00', allDay: false },
      { title: 'Cumple de la Jose', date: '2026-10-20', allDay: true },
    ];
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await page.reload();
};

test('Día marca los huecos libres entre clases seguidas y eventos de Google', async ({ page, app }) => {
  await conDia(page, app);
  await app.abrir('dia');
  const libres = page.locator('.block.hueco');
  await expect(libres).toHaveCount(2);
  await expect(libres.nth(0)).toContainText('11:30–13:00');
  await expect(libres.nth(1)).toContainText('14:00–20:00');
  await expect(page.locator('.block.hueco', { hasText: '10:00' })).toHaveCount(0); // entre clases seguidas no hay hueco
  await libres.nth(0).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/capturas/dia-huecos.png' });
});

test('Ahora muestra el próximo hueco de hoy (en clase, en la misma pastilla)', async ({ page, app }) => {
  await conDia(page, app);
  await expect(page.locator('.pill', { hasText: 'En Finanzas' })).toContainText('después, libre hasta las 13:00');
  await expect(page.locator('.pill.free')).toHaveCount(0);
  await page.screenshot({ path: 'tests/capturas/ahora-hueco.png' });
});

test('fuera de clase, Ahora muestra el próximo hueco en su propia pastilla', async ({ page, app }) => {
  await conDia(page, app);
  await page.clock.setFixedTime(new Date(2026, 9, 20, 13, 30)); // en el almuerzo (Google): el hueco viene a las 14:00
  await page.reload();
  await expect(page.locator('.pill', { hasText: 'Almuerzo' })).toContainText('después, libre hasta las 20:00');
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12, 0)); // en un hueco
  await page.reload();
  await expect(page.locator('.pill.free')).toHaveText('🟢 Libre ahora hasta las 13:00 · 1h');
});

test('tocar un hueco de hoy en Día lleva a Ahora', async ({ page, app }) => {
  await conDia(page, app);
  await app.abrir('dia');
  await page.locator('.block.hueco').first().click();
  await expect(page).toHaveURL(/#\/ahora/);
});

test('si ya estás en un hueco, Ahora dice hasta cuándo', async ({ page, app }) => {
  await conDia(page, app);
  await page.clock.setFixedTime(new Date(2026, 9, 20, 14, 20));
  await page.reload();
  await expect(page.locator('.pill.free')).toContainText('Libre ahora hasta las 20:00');
});

test('el sábado sin nada anotado no inventa huecos', async ({ page, app }) => {
  await conDia(page, app);
  await page.clock.setFixedTime(new Date(2026, 9, 24, 10, 0)); // sábado
  await page.reload();
  await expect(page.locator('.pill.free')).toHaveCount(0);
  await app.abrir('dia');
  await expect(page.locator('.block.hueco')).toHaveCount(0);
});
