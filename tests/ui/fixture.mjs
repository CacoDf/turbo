// Datos de prueba y ayudantes. La hora queda fija (martes 10:00) para que las capturas sean estables.
import { test as base, expect } from '@playwright/test';

export const HOY = new Date(2026, 9, 20, 10, 0, 0); // martes 20-oct-2026
export const KEY = 'turbo.v1';

export const estadoDePrueba = () => ({
  version: 1,
  tasks: [
    { id: 't1', title: 'Estudiar finanzas', area: 'estudios', minutes: 25, due: '2026-10-22', steps: [], today: false, done: false, createdAt: HOY.getTime(), focusMs: 0, skips: 0 },
    { id: 't2', title: 'Pagar la cuenta del celu', area: 'personal', minutes: 10, due: null, steps: [], today: false, done: false, createdAt: HOY.getTime(), focusMs: 0, skips: 0 },
  ],
  currentTaskId: 't1',
  meta: { createdAt: HOY.getTime(), updatedAt: HOY.getTime(), onboarded: true },
});

// Falla la prueba si la página escribe errores en la consola o lanza excepciones.
export const test = base.extend({
  errores: async ({ page }, use) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => m.type() === 'error' && !/favicon|\/api\//.test(m.text()) && errores.push(m.text()));
    await use(errores);
  },
  app: async ({ page, errores }, use) => {
    await page.clock.install({ time: HOY });
    await page.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, s); }, [KEY, JSON.stringify(estadoDePrueba())]);
    await use({
      async abrir(ruta = '') {
        await page.goto(`/#/${ruta}`);
        await expect(page.locator('#app')).not.toBeEmpty();
      },
      guardado: () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY),
    });
    expect(errores, 'errores en la consola').toEqual([]);
  },
});
export { expect };
