// Flujos del ciclo central: anotar, partir un foco, marcar un hábito y no perder datos.
import { test, expect, KEY, HOY, estadoDePrueba } from './fixture.mjs';

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
  // Se agrega un dato nuevo y, tras recargar, nadie vuelve a sembrar: si la app lo perdiera, falla.
  await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.tasks.push({ ...s.tasks[0], id: 't3', title: 'Tarea nueva' }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload();
  await expect(page.getByText('Estudiar finanzas').first()).toBeVisible();
  const s = await app.guardado();
  expect(s.tasks.map(t => t.id)).toEqual(['t1', 't2', 't3']);
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

test('los datos de módulos congelados siguen intactos después de usar la app', async ({ page, app }) => {
  const congelados = {
    money: { expenses: [{ id: 'e1', amount: 4500, cat: 'comida', t: HOY.getTime() }], wishlist: [], weekBudget: 30000 },
    partner: { enabled: true, token: 'x'.repeat(36), showTitles: false, cheers: [{ from: 'Ana', msg: 'Vamos' }], seenCheers: 0 },
    goals: [{ id: 'g1', title: 'Titularme', why: 'porque sí', deadline: null, createdAt: HOY.getTime(), weekPlanned: null, done: false }],
    shield: { since: HOY.getTime(), best: 3, events: [], guide: {} },
    challenges: { month: '2026-10', claimed: ['c1'] },
  };
  await page.addInitScript(([k, extra]) => {
    if (sessionStorage.getItem('congelados')) return;
    sessionStorage.setItem('congelados', '1');
    const s = JSON.parse(localStorage.getItem(k));
    Object.assign(s, extra);
    localStorage.setItem(k, JSON.stringify(s));
  }, [KEY, congelados]);
  await app.abrir('habitos');
  await page.locator('button.check.big').first().click(); // un cambio real que guarda el estado
  await app.abrir('dia');
  await page.reload();
  const s = await app.guardado();
  for (const [clave, valor] of Object.entries(congelados)) expect(s[clave], clave).toEqual(valor);
  expect(Object.values(s.habitLog).some(d => Object.keys(d).length)).toBe(true);
});

test('Capturar no abre el teclado sola (en iPhone descuadra la barra de abajo)', async ({ page, app }) => {
  await app.abrir('capturar');
  await expect(page.locator('#capText')).toBeVisible();
  await expect(page.locator('#capText')).not.toBeFocused();
});

test('"dentista jueves 15:00" queda como evento y se ve en Día ese jueves', async ({ page, app }) => {
  await app.abrir('capturar');
  await page.locator('#capText').fill('dentista jueves 15:00');
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await expect(page.locator('input[type=time]').first()).toHaveValue('15:00');
  await page.screenshot({ path: 'tests/capturas/capturar-evento.png' });
  await page.getByRole('button', { name: /Guardar 1 evento/ }).click();
  await expect(page).toHaveURL(/#\/dia/);
  const s = await app.guardado();
  expect(s.schedule.filter(b => b.date)).toMatchObject([{ title: 'Dentista', date: '2026-10-22', start: '15:00', end: '16:00', src: 'turbo' }]);
  await expect(page.locator('.block', { hasText: 'Dentista' })).toBeVisible();
  await expect(page.locator('.block', { hasText: '15:00–16:00' })).toBeVisible();
  await page.screenshot({ path: 'tests/capturas/dia-evento.png', fullPage: true });
});

test('mezcla: una tarea y un evento con tilde en el día ("miércoles")', async ({ page, app }) => {
  await app.abrir('capturar');
  await page.locator('#capText').fill('comprar pan\nreunión miércoles 10:30');
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await page.getByRole('button', { name: /Guardar 1 evento y 1 tarea/ }).click();
  const s = await app.guardado();
  expect(s.tasks.some(t => t.title === 'Comprar pan')).toBe(true);
  expect(s.schedule.filter(b => b.date)).toMatchObject([{ title: 'Reunión', date: '2026-10-21', start: '10:30' }]);
});

test('ponerle hora a una tarea la convierte en evento, y quitarla la devuelve a tarea', async ({ page, app }) => {
  await app.abrir('capturar');
  await page.locator('#capText').fill('llamar al banco mañana');
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await page.locator('input[type=time]').first().fill('11:00');
  await expect(page.getByRole('button', { name: /Guardar 1 evento/ })).toBeVisible();
  await page.locator('input[type=time]').first().fill('');
  await expect(page.getByRole('button', { name: /Guardar 1 tarea/ })).toBeVisible();
});

test('Día tiene el botón ↻ para actualizar el calendario', async ({ page, app }) => {
  await app.abrir('dia');
  await expect(page.getByRole('button', { name: 'Actualizar calendario' })).toBeVisible();
  await page.getByRole('button', { name: 'Actualizar calendario' }).click();
  await expect(page.getByText(/Conecta tu calendario/)).toBeVisible();
});

test('↻ en Día trae lo que se anotó en Google Calendar (también un evento nuevo) y se ve junto al de Turbo', async ({ page, app }) => {
  let eventos = [{ title: 'Ayudantía Finanzas', date: '2026-10-20', allDay: false, start: '12:00', end: '13:00' }];
  const pedidos = [];
  await page.route('**/api/**', route => route.fulfill({ json: {} })); // lo demás del servidor (respaldo, avisos): sin respuesta útil
  await page.route('**/api/calendar/import**', route => {
    pedidos.push(route.request().url());
    return route.fulfill({ json: { connected: true, events: eventos } });
  });
  await app.abrir('dia');
  await page.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.settings = { ...(s.settings || {}), secret: 'x' };
    s.schedule = [...(s.schedule || []), { id: 'dent', title: 'Dentista', kind: 'otro', days: [], date: '2026-10-20', start: '15:00', end: '16:00', src: 'turbo' }];
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await page.reload();
  await expect(page.locator('.block', { hasText: 'Dentista' })).toBeVisible();
  // Día se desplaza solo hasta "ahora": el botón ↻ tiene que seguir a la vista.
  await expect(page.getByRole('button', { name: 'Actualizar calendario' })).toBeInViewport();
  await page.getByRole('button', { name: 'Actualizar calendario' }).click();
  await expect(page.locator('.block', { hasText: 'Ayudantía Finanzas' })).toBeVisible();
  await expect(page.locator('.block', { hasText: 'Dentista' })).toBeVisible();
  // Alguien agrega algo en Google: con ↻ aparece sin esperar.
  eventos = [...eventos, { title: 'Cine con Caro', date: '2026-10-20', allDay: false, start: '20:00', end: '22:00' }];
  await page.getByRole('button', { name: 'Actualizar calendario' }).click();
  await expect(page.locator('.block', { hasText: 'Cine con Caro' })).toBeVisible();
  expect(pedidos.some(u => /force=1/.test(u)), 'el botón fuerza la lectura').toBe(true);
  await page.screenshot({ path: 'tests/capturas/dia-google-y-turbo.png' });
});

test('un evento lejano (más de 14 días) abre Día en su fecha y, al salir y volver, Día parte en hoy', async ({ page, app }) => {
  await app.abrir('capturar');
  await page.locator('#capText').fill('certamen 23/11 a las 9');
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await page.screenshot({ path: 'tests/capturas/capturar-lejano.png' });
  await page.getByRole('button', { name: /Guardar 1 evento/ }).click();
  await expect(page.getByText(/Lunes 23 nov/)).toBeVisible();
  await expect(page.locator('.block', { hasText: 'Certamen' })).toBeVisible();
  await expect(page.getByText(/Certamen: lun 23 a las 09:00/)).toBeVisible();
  await page.locator('#nav a', { hasText: 'Ahora' }).click();
  await page.locator('#nav a', { hasText: 'Día' }).click();
  await expect(page.getByText(/Hoy Martes 20 oct/)).toBeVisible();
});

test('un evento de Turbo que se topa con uno de Google se ven los dos, lado a lado', async ({ page, app }) => {
  await app.abrir('dia');
  await page.evaluate(k => {
    const s = JSON.parse(localStorage.getItem(k));
    s.extEvents = [{ title: 'Reunión grupo', date: '2026-10-22', allDay: false, start: '14:30', end: '16:00' }];
    s.schedule = [...(s.schedule || []), { id: 'dent', title: 'Dentista', kind: 'otro', days: [], date: '2026-10-22', start: '15:00', end: '16:00', src: 'turbo' }];
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Día siguiente' }).click();
  await page.getByRole('button', { name: 'Día siguiente' }).click();
  const dentista = page.locator('.block', { hasText: 'Dentista' });
  const reunion = page.locator('.block', { hasText: 'Reunión grupo' });
  await dentista.scrollIntoViewIfNeeded();
  await expect(dentista).toBeVisible();
  await expect(reunion).toBeVisible();
  const a = await dentista.boundingBox();
  const b = await reunion.boundingBox();
  const seTapan = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(seTapan, 'ninguno tapa al otro').toBe(false);
  await page.screenshot({ path: 'tests/capturas/dia-topes.png' });
});
