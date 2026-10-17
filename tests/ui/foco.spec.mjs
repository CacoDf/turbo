// Foco con tiempos a gusto: elegir foco y descanso (como el temporizador del celular), descansar y otra vuelta.
import { test, expect, KEY } from './fixture.mjs';

test('elegir 37 / 10, partir, descansar y volver a la misma tarea; los minutos quedan guardados', async ({ page, app }) => {
  await app.abrir('foco');
  await expect(page.getByText('Clásico 25 / 5')).toBeVisible();
  await page.getByLabel('Minutos de foco').selectOption('37');
  await page.getByLabel('Minutos de descanso').selectOption('10');
  await expect(page.getByRole('button', { name: '▶ Partir 37 min' })).toBeVisible();
  await page.screenshot({ path: 'tests/capturas/foco-elegir.png' });
  let s = await app.guardado();
  expect(s.settings).toMatchObject({ focoMin: 37, descansoMin: 10 });

  // En Ahora, la rueda muestra sus minutos y el botón de foco parte con la tarea.
  await page.locator('#nav a', { hasText: 'Ahora' }).click();
  await expect(page.getByLabel('Minutos de foco')).toHaveValue('37');
  await expect(page.getByLabel('Minutos de descanso')).toHaveValue('10');
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

test('en Ahora se eligen foco y descanso con las mismas ruedas, y Foco los recuerda', async ({ page, app }) => {
  await app.abrir('ahora');
  const rueda = page.getByLabel('Minutos de foco');
  await expect(rueda).toHaveValue('25'); // el clásico de fábrica
  await expect(page.getByLabel('Minutos de descanso')).toHaveValue('5');
  await rueda.selectOption('45');
  await page.getByLabel('Minutos de descanso').selectOption('12');
  expect((await app.guardado()).settings).toMatchObject({ focoMin: 45, descansoMin: 12 });
  await expect(rueda).toHaveValue('45');
  await expect(page.getByRole('button', { name: 'Foco 45 min' })).toBeVisible();
  await page.locator('.card.now').screenshot({ path: 'tests/capturas/ahora-foco-elegir.png' }); // la fila queda bajo la barra en la captura de pantalla
  await page.getByRole('button', { name: 'Foco 45 min' }).click();
  expect((await app.guardado()).focus).toMatchObject({ plannedMin: 45, taskId: 't1' });
  await expect(page.getByText('de 45 min')).toBeVisible();
  await page.clock.fastForward('45:05');
  await expect(page.getByRole('button', { name: '☕ Descanso 12 min' })).toBeVisible();
  await page.getByRole('button', { name: 'Lo dejo aquí por ahora' }).click();
  await page.locator('#nav a', { hasText: 'Foco' }).click();
  await expect(page.getByLabel('Minutos de foco')).toHaveValue('45');
  await expect(page.getByLabel('Minutos de descanso')).toHaveValue('12');
});

test('con un evento del calendario en curso, la rueda también está y el botón usa sus minutos', async ({ page, app }) => {
  await page.addInitScript(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.extEvents = [{ date: '2026-10-20', start: '09:45', end: '11:45', title: '📚 Estudio Prueba 2 GCS' }];
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await app.abrir('ahora');
  await expect(page.getByText('AHORA EN TU CALENDARIO')).toBeVisible();
  await expect(page.getByRole('button', { name: '▶ 25 min de foco' })).toBeVisible();
  await page.getByLabel('Minutos de foco').selectOption('50');
  await expect(page.getByRole('button', { name: '▶ 50 min de foco' })).toBeVisible();
  await page.getByLabel('Minutos de descanso').selectOption('10');
  await expect(page.getByText('varias vueltas de 50 min con 10 de descanso')).toBeVisible();
  await page.locator('.cal-now').screenshot({ path: 'tests/capturas/ahora-calendario-foco.png' });
  await page.getByLabel('Minutos de foco').selectOption('120'); // quedan 105 min del evento: no se pasa del final
  await expect(page.getByRole('button', { name: '▶ 105 min de foco' })).toBeVisible();
  await page.getByRole('button', { name: '▶ 105 min de foco' }).click();
  expect((await app.guardado()).focus).toMatchObject({ plannedMin: 105, label: '📚 Estudio Prueba 2 GCS' });
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

// Cuenta cuánto audio crea la app: en Turbo solo debe sonar el pomodoro (el resto, como suene el iPhone).
const espiarAudio = page => page.addInitScript(() => {
  const Real = window.AudioContext;
  window.__audio = { creados: 0, osc: 0, ultimo: null };
  window.AudioContext = class extends Real {
    constructor(...a) { super(...a); window.__audio.creados++; window.__audio.ultimo = this; }
    createOscillator() { window.__audio.osc++; return super.createOscillator(); }
  };
});
const audio = page => page.evaluate(() => ({ creados: window.__audio.creados, osc: window.__audio.osc, estado: window.__audio.ultimo?.state || null }));

test('fuera del pomodoro la app no crea audio (las notificaciones suenan como el iPhone)', async ({ page, app }) => {
  await espiarAudio(page);
  await app.abrir('ahora');
  await page.locator('#nav a', { hasText: 'Día' }).click();
  await page.locator('#nav a', { hasText: 'Capturar' }).click();
  await page.locator('#nav a', { hasText: 'Ahora' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  expect((await audio(page)).creados).toBe(0);
});

test('el pomodoro que termina con Foco abierto suena 3 veces y después el audio se duerme', async ({ page, app }) => {
  await espiarAudio(page);
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  expect((await audio(page)).osc).toBe(0);
  await page.clock.fastForward('24:58');
  await page.clock.runFor(3000);
  await expect(page.getByRole('button', { name: '☕ Descanso 5 min' })).toBeVisible();
  expect((await audio(page)).osc).toBe(4); // una campanita = 2 notas × (nota + armónico)
  await page.clock.runFor(20000);
  const a = await audio(page);
  expect(a.osc).toBe(12); // 3 veces y para sola
  expect(a.estado).toBe('suspended');
});

test('llegar a Foco con la sesión ya vencida (desde la notificación) muestra la hoja sin sonar', async ({ page, app }) => {
  await espiarAudio(page);
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  await page.reload(); // como abrir la app de nuevo al tocar el aviso
  await page.clock.fastForward('26:00');
  await page.clock.runFor(2000);
  await expect(page.getByRole('button', { name: '☕ Descanso 5 min' })).toBeVisible();
  expect((await audio(page)).osc).toBe(0);
});

test('después de una alarma, "Sigo 15 min" deja el audio listo y el nuevo final también suena', async ({ page, app }) => {
  await espiarAudio(page);
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  await page.clock.fastForward('24:58');
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: 'Sigo 15 min más 🔥' }).click();
  await page.clock.runFor(5000); // el "dormir" pendiente de la alarma anterior no debe apagar el audio
  expect((await audio(page)).estado).toBe('running');
  const antes = (await audio(page)).osc;
  await page.clock.fastForward('14:45');
  await page.clock.runFor(12000); // cruza el nuevo final (15 min desde el toque)
  expect((await audio(page)).osc).toBeGreaterThan(antes);
});

test('si la app se recargó a mitad del foco, el primer toque deja lista la alarma', async ({ page, app }) => {
  await espiarAudio(page);
  await app.abrir('foco');
  await page.getByRole('button', { name: /Partir 25 min/ }).click();
  await page.reload();
  expect((await audio(page)).creados).toBe(0);
  await page.locator('.focus-screen').click({ position: { x: 20, y: 20 } }); // un toque cualquiera en Foco
  await page.clock.fastForward('24:55');
  await page.clock.runFor(6000);
  expect((await audio(page)).osc).toBe(4);
});
