// Pruebas de interfaz: WebKit (motor de Safari) con el tamaño de un iPhone 15.
// Si WebKit no está instalado (ej. entorno en la nube), cae a Chromium con el mismo viewport y lo avisa.
import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const raiz = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');
const hayWebkit = existsSync(raiz) && readdirSync(raiz).some(d => d.startsWith('webkit'));
// Chromium solo si se pide a propósito (TURBO_BROWSER=chromium, p. ej. en la nube). Si no, WebKit es obligatorio.
const usarChromium = process.env.TURBO_BROWSER === 'chromium';
if (usarChromium) console.warn('⚠️  Usando Chromium con viewport de iPhone 15 (no es WebKit).');
else if (!hayWebkit) throw new Error('Falta WebKit. Corre: npx playwright install webkit (o TURBO_BROWSER=chromium para probar sin WebKit).');

const iphone = devices['iPhone 15'];
const use = usarChromium
  ? { ...iphone, defaultBrowserType: 'chromium', ...(existsSync('/opt/pw-browsers/chromium') ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } : {}) }
  : iphone;

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: 'test-results',
  reporter: 'list',
  use: { ...use, baseURL: 'http://localhost:8791' },
  webServer: { command: 'node tests/serve.mjs', url: 'http://localhost:8791', reuseExistingServer: false },
});
