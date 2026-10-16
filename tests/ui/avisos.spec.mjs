// Lo que la app pone de su parte en los avisos: el "día mínimo" al volver, el número del ícono
// y el silencio de noche en Ajustes. Los avisos mismos los calcula el servidor (tests/worker/).
import { test, expect, KEY, HOY } from './fixture.mjs';

const DIA = 86400000;

test('desde el aviso del día mínimo: Ahora ofrece 2 minutos y el botón parte el foco', async ({ page, app }) => {
  await page.goto('/?minimo=1#/ahora');
  await expect(page.getByRole('heading', { name: 'Día mínimo: 2 minutos' })).toBeVisible();
  await expect(page).not.toHaveURL(/minimo/); // si recarga, no vuelve a aparecer
  await expect(page.getByText('Estudiar finanzas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Foco 25 min/ })).toHaveCount(0); // una sola decisión
  await page.screenshot({ path: 'tests/capturas/dia-minimo.png' });
  await page.getByRole('button', { name: '▶ 2 minutos' }).click();
  await expect(page).toHaveURL(/#\/foco/);
  const s = await app.guardado();
  expect(s.focus.plannedMin).toBe(2);
  expect(s.focus.taskId).toBe('t1');
});

test('tras 3 días sin abrir aparece el día mínimo; "Hoy no" vuelve a lo normal', async ({ page, app }) => {
  await page.addInitScript(t => { if (!sessionStorage.getItem('visto')) { sessionStorage.setItem('visto', '1'); localStorage.setItem('turbo.visto', String(t)); } }, HOY.getTime() - 4 * DIA);
  await app.abrir('ahora');
  await expect(page.getByRole('heading', { name: 'Día mínimo: 2 minutos' })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy no' }).click();
  await expect(page.getByRole('heading', { name: 'Día mínimo: 2 minutos' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Solo 5 minutos/ })).toBeVisible();
  expect(Number(await page.evaluate(() => localStorage.getItem('turbo.visto')))).toBeGreaterThanOrEqual(HOY.getTime());
});

test('con uso reciente no aparece el día mínimo', async ({ page, app }) => {
  await page.addInitScript(t => localStorage.setItem('turbo.visto', String(t)), HOY.getTime() - DIA);
  await app.abrir('ahora');
  await expect(page.getByRole('button', { name: /Solo 5 minutos/ })).toBeVisible();
  await expect(page.getByText('Día mínimo')).toHaveCount(0);
});

test('número en el ícono: tareas para hoy, y se borra cuando no queda ninguna', async ({ page, app }) => {
  await page.addInitScript(k => {
    window.__badge = [];
    navigator.setAppBadge = n => { window.__badge.push(n); return Promise.resolve(); };
    navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); };
    if (sessionStorage.getItem('hoy')) return;
    sessionStorage.setItem('hoy', '1');
    const s = JSON.parse(localStorage.getItem(k));
    s.tasks.push({ ...s.tasks[0], id: 't9', title: 'Vence hoy', due: '2026-10-20' });
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await app.abrir('tareas');
  await expect.poll(() => page.evaluate(() => window.__badge.at(-1))).toBe(1);
  // Se marca terminada con la misma función que usan los botones (pasa por update(), como un toque real).
  await page.evaluate(() => import('/js/actions.js').then(m => m.completeTask('t9')));
  await expect.poll(() => page.evaluate(() => window.__badge.at(-1))).toBe(0);
});

test('Ajustes: silencio de noche 00:30–06:00 aunque el estado guardado sea viejo, y se puede cambiar', async ({ page, app }) => {
  await app.abrir('ajustes');
  const desde = page.locator('input[data-f="sleepAt"]');
  const hasta = page.locator('input[data-f="wakeAt"]');
  await expect(desde).toHaveValue('00:30');
  await expect(hasta).toHaveValue('06:00');
  await desde.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/capturas/ajustes-silencio.png' });
  await desde.fill('01:00');
  await desde.dispatchEvent('change');
  expect((await app.guardado()).settings.sleepAt).toBe('01:00');
});
