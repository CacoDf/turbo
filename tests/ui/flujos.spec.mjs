// Flujos del ciclo central: anotar, partir un foco, marcar un hábito y no perder datos.
import { test, expect, KEY, estadoDePrueba } from './fixture.mjs';

test('anotar sin IA: aparece como tarea guardada', async ({ page, app }) => {
  await app.abrir('capturar');
  await page.locator('#capText').fill('comprar regalo para mi mamá el viernes');
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await expect(page.getByRole('heading', { name: 'Revisa y guarda' })).toBeVisible();
  await page.getByRole('button', { name: /Guardar 1 tarea/ }).click();
  await expect(page).toHaveURL(/#\/ahora/);
  const s = await app.guardado();
  expect(s.tasks.some(t => /regalo para mi mamá/i.test(t.title))).toBe(true);
});

test('Ahora muestra una tarea y "Solo 5 minutos" abre Foco sin barra de navegación', async ({ page, app }) => {
  await app.abrir('ahora');
  await expect(page.getByText('Estudiar finanzas').first()).toBeVisible();
  await page.getByRole('button', { name: /Solo 5 minutos/ }).first().click();
  await expect(page).toHaveURL(/#\/foco/);
  await expect(page.locator('#nav')).toBeHidden();
  await page.screenshot({ path: 'tests/capturas/flujo-foco-activo.png' });
  expect((await app.guardado()).focus).not.toBeNull();
});

test('marcar un hábito lo deja hecho y se guarda', async ({ page, app }) => {
  await app.abrir('habitos');
  const marca = page.locator('button.check.big').first();
  await marca.click();
  await expect(marca).toHaveClass(/on/);
  const s = await app.guardado();
  expect(Object.values(s.habitLog).some(d => Object.keys(d).length)).toBe(true);
});

test('los datos siguen ahí después de recargar', async ({ page, app }) => {
  await app.abrir('ahora');
  await page.reload();
  const s = await app.guardado();
  expect(s.tasks.map(t => t.id)).toEqual(['t1', 't2']);
});

test('un estado viejo e incompleto se completa sin perder tareas', async ({ page, errores }) => {
  const viejo = { version: 1, tasks: estadoDePrueba().tasks, meta: { onboarded: true } };
  await page.addInitScript(([k, s]) => localStorage.setItem(k, s), [KEY, JSON.stringify(viejo)]);
  await page.goto('/#/ahora');
  await expect(page.getByText('Estudiar finanzas').first()).toBeVisible();
  const s = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  expect(s.tasks).toHaveLength(2);
  expect(Array.isArray(s.habits)).toBe(true);
  expect(errores).toEqual([]);
});
