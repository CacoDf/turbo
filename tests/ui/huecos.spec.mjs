// Huecos libres (Sesión 3): Día los dibuja entre eventos y Ahora muestra el próximo.
import { test, expect, KEY } from './fixture.mjs';

// Martes 20-oct, 10:00. Clases seguidas 08:30–10:00 y 10:00–11:30, almuerzo de Google 13:00–14:00
// y un evento de todo el día (no ocupa tiempo). Huecos esperados: 08:00–08:30, 11:30–13:00 y 14:00–20:00.
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
  await expect(libres).toHaveCount(3);
  await expect(libres.nth(0)).toContainText('08:00–08:30');
  await expect(libres.nth(1)).toContainText('11:30–13:00');
  await expect(libres.nth(2)).toContainText('14:00–20:00');
  await expect(page.locator('.block.hueco', { hasText: '10:00' })).toHaveCount(0); // entre clases seguidas no hay hueco
  await libres.nth(1).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/capturas/dia-huecos.png' });
});

test('Ahora muestra el próximo hueco de hoy', async ({ page, app }) => {
  await conDia(page, app);
  await expect(page.locator('.pill.free')).toHaveText('🕳️ Libre de 11:30 a 13:00 · 1h 30min');
  await page.screenshot({ path: 'tests/capturas/ahora-hueco.png' });
});

test('si ya estás en un hueco, Ahora dice hasta cuándo', async ({ page, app }) => {
  await conDia(page, app);
  await page.clock.setFixedTime(new Date(2026, 9, 20, 14, 20));
  await page.reload();
  await expect(page.locator('.pill.free')).toContainText('Libre ahora hasta las 20:00');
});
