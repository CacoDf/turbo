// Foco con tiempos a gusto: elegir foco y descanso (como el temporizador del celular), descansar y otra vuelta.
import { test, expect } from './fixture.mjs';

test('elegir 37 / 10, partir, descansar y volver a la misma tarea; los minutos quedan guardados', async ({ page, app }) => {
  await app.abrir('foco');
  await expect(page.getByText('Clásico 25 / 5')).toBeVisible();
  await page.getByLabel('Minutos de foco').selectOption('37');
  await page.getByLabel('Minutos de descanso').selectOption('10');
  await expect(page.getByRole('button', { name: '▶ Partir 37 min' })).toBeVisible();
  await page.screenshot({ path: 'tests/capturas/foco-elegir.png' });
  let s = await app.guardado();
  expect(s.settings).toMatchObject({ focoMin: 37, descansoMin: 10 });

  // En Ahora, el botón de foco usa sus minutos; parte con la tarea.
  await page.locator('#nav a', { hasText: 'Ahora' }).click();
  await page.getByRole('button', { name: 'Foco 37 min' }).click();
  s = await app.guardado();
  expect(s.focus).toMatchObject({ plannedMin: 37, taskId: 't1' });

  // Termina el foco: la primera opción es descansar.
  await page.clock.fastForward('37:05');
  await expect(page.getByRole('button', { name: '☕ Descanso 10 min' })).toBeVisible();
  await page.screenshot({ path: 'tests/capturas/foco-fin.png' });
  await page.getByRole('button', { name: '☕ Descanso 10 min' }).click();
  s = await app.guardado();
  expect(s.focus).toMatchObject({ descanso: true, plannedMin: 10, taskId: null, volverA: 't1' });
  const trabajado = s.tasks.find(t => t.id === 't1').focusMs;
  expect(trabajado).toBeGreaterThan(36 * 60000);
  await expect(page.getByText('☕ Descanso').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '+5 min' })).toHaveCount(0);
  await page.screenshot({ path: 'tests/capturas/foco-descanso.png' });

  // Termina el descanso: otra vuelta con la misma tarea, y el descanso no sumó minutos a la tarea.
  await page.clock.fastForward('10:05');
  await expect(page.getByRole('button', { name: '▶ Otra vuelta de 37 min' })).toBeVisible();
  await page.getByRole('button', { name: '▶ Otra vuelta de 37 min' }).click();
  s = await app.guardado();
  expect(s.focus).toMatchObject({ taskId: 't1', plannedMin: 37 });
  expect(s.focus.descanso).toBeUndefined();
  expect(s.tasks.find(t => t.id === 't1').focusMs).toBe(trabajado);

  // Al cerrar y volver, Foco recuerda 37 / 10 y ofrece volver al clásico.
  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await page.getByRole('button', { name: 'Lo dejo aquí por ahora' }).click();
  await page.locator('#nav a', { hasText: 'Foco' }).click();
  await expect(page.getByLabel('Minutos de foco')).toHaveValue('37');
  await expect(page.getByLabel('Minutos de descanso')).toHaveValue('10');
  await page.getByRole('button', { name: 'Volver al clásico 25 / 5' }).click();
  await expect(page.getByText('✓ Clásico 25 / 5')).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ Partir 25 min' })).toBeVisible();
});

test('cortar el descanso antes también ofrece otra vuelta', async ({ page, app }) => {
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await expect(page.getByRole('button', { name: /Descanso/ }), 'si corta antes, no se ofrece descanso').toHaveCount(0);
  await page.locator('.sheet-bg').click({ position: { x: 10, y: 10 } });
  await page.clock.fastForward('25:01');
  await page.getByRole('button', { name: '☕ Descanso 5 min' }).click();
  await page.getByRole('button', { name: 'Terminar descanso' }).click();
  await expect(page.getByText('Cortar el descanso')).toBeVisible();
  await page.getByRole('button', { name: 'Lo dejo aquí por ahora' }).click();
  await expect(page).toHaveURL(/#\/ahora/);
  expect((await app.guardado()).focus).toBeNull();
});

test('al terminar un foco de 25 min (múltiplo de 5) la hoja sale una sola vez: cerrada, no vuelve', async ({ page, app }) => {
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  await page.clock.fastForward('25:01');
  await expect(page.getByRole('button', { name: '☕ Descanso 5 min' })).toBeVisible();
  await page.locator('.sheet-bg').click({ position: { x: 10, y: 10 } }); // la cierra tocando el fondo
  await expect(page.locator('#sheet')).toHaveCount(0);
  await page.clock.fastForward('00:05');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // como al volver a la app
  await page.clock.fastForward('00:03');
  await expect(page.locator('#sheet')).toHaveCount(0);
});
