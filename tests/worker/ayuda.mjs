// Worker real (workerd) con D1 real en memoria, vía Miniflare. Lo externo (push, Gemini, .ics) se simula.
// El navegador que recibe los push también se simula: navegador() crea sus claves y descifrar() lee lo que llegó.
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

export const SECRETO = 'secreto';

export async function crearMundo(extra = {}) {
  const mundo = { pushes: [], geminiReply: null, externo: new Map(), fetchesExternos: [] };
  mundo.mf = new Miniflare({
    modules: true,
    scriptPath: `${RAIZ}/src/worker.js`,
    modulesRoot: RAIZ,
    // Como wrangler: los .js de src/ son módulos ES, y también lo que comparten con la app (huecos.js).
    modulesRules: [{ type: 'ESModule', include: ['src/**/*.js', 'public/js/huecos.js'] }],
    compatibilityDate: '2025-09-01',
    d1Databases: { DB: 'test-db' },
    bindings: { APP_SECRET: SECRETO, ...extra },
    serviceBindings: { ASSETS: async () => new Response('asset') },
    outboundService: async req => {
      const u = req.url;
      mundo.fetchesExternos.push(u);
      if (u.startsWith('https://push.test/')) { mundo.pushes.push({ url: u, headers: Object.fromEntries(req.headers), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('', { status: 201 }); }
      if (u.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(mundo.geminiReply) }] } }] }), { status: 200 });
      }
      if (mundo.externo.has(u)) return mundo.externo.get(u)();
      if (mundo.google && u.startsWith('https://script.google.com/macros/s/')) return mundo.google(req);
      return new Response('no simulado: ' + u, { status: 599 });
    },
  });
  const url = path => `https://turbo.test/api/${path}`;
  mundo.req = (method, path, body, auth = true) => mundo.mf.dispatchFetch(url(path), {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${SECRETO}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  mundo.json = async (...a) => (await mundo.req(...a)).json();
  mundo.share = (method, path, token, body) => mundo.mf.dispatchFetch(url(path), {
    method, headers: { 'Content-Type': 'application/json', 'X-Share-Token': token }, body: body ? JSON.stringify(body) : undefined,
  });
  mundo.pendientes = async endpoint => (await mundo.mf.dispatchFetch(url('push/pending?endpoint=' + encodeURIComponent(endpoint)))).json();
  // Corre el cron como si fuera la hora indicada (ms). Sin hora, ahora.
  mundo.cron = async (hora = Date.now()) => { const w = await mundo.mf.getWorker(); await w.scheduled({ scheduledTime: new Date(hora), cron: '* * * * *' }); };
  mundo.cerrar = () => mundo.mf.dispose();
  return mundo;
}

// ---- Navegador simulado: claves de la suscripción y descifrado RFC 8291 (aes128gcm) ----

const b64u = bytes => Buffer.from(bytes).toString('base64url');
const unir = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const hkdf = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info },
  await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8));

export async function navegador(endpoint) {
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { endpoint, privada: par.privateKey, pub, auth, sub: { endpoint, keys: { p256dh: b64u(pub), auth: b64u(auth) } } };
}

export async function descifrar(nav, body) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secreto = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, nav.privada, 256));
  const te = new TextEncoder();
  const ikm = await hkdf(nav.auth, secreto, unir(te.encode('WebPush: info\0'), nav.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const claro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idlen)));
  if (claro[claro.length - 1] !== 2) throw new Error('falta el delimitador de último registro');
  return JSON.parse(new TextDecoder().decode(claro.slice(0, -1)));
}

// Hora "de pared" en Chile de un instante: { key: 'YYYY-MM-DD', hm: 'HH:MM', ics: 'YYYYMMDDTHHMM00' }.
export function chile(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { key: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, ics: `${p.year}${p.month}${p.day}T${p.hour}${p.minute}00` };
}
