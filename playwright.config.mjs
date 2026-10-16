// Pruebas de interfaz: WebKit (motor de Safari) con el tamaño de un iPhone 15.
// Si WebKit no está instalado (ej. entorno en la nube), cae a Chromium con el mismo viewport y lo avisa.
import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const raiz = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');
const hayWebkit = existsSync(raiz) && readdirSync(raiz).some(d => d.startsWith('webkit'));
const usarChromium = process.env.TURBO_BROWSER === 'chromium' || !hayWebkit;
if (usarChromium) console.warn('⚠️  WebKit no está instalado: usando Chromium con viewport de iPhone 15. En tu PC corre: npx playwright install webkit');

const iphone = devices['iPhone 15'];
const use = usarChromium
  ? { ...iphone, defaultBrowserType: 'chromium', ...(existsSync('/opt/pw-browsers/chromium') ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } : {}) }
  : iphone;

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: 'test-results',
  reporter: 'list',
  use: { ...use, baseURL: 'http://localhost:8787' },
  webServer: { command: 'node tests/serve.mjs', url: 'http://localhost:8787', reuseExistingServer: true },
});
