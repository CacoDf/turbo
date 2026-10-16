// Worker real (workerd) con D1 real en memoria, vía Miniflare. Lo externo (push, Gemini, .ics) se simula.
import { Miniflare } from 'miniflare';

export const SECRETO = 'secreto';

export async function crearMundo(extra = {}) {
  const mundo = { pushes: [], geminiReply: null, externo: new Map(), fetchesExternos: [] };
  mundo.mf = new Miniflare({
    modules: true,
    scriptPath: 'src/worker.js',
    modulesRoot: 'src',
    compatibilityDate: '2025-09-01',
    d1Databases: { DB: 'test-db' },
    bindings: { APP_SECRET: SECRETO, ...extra },
    serviceBindings: { ASSETS: async () => new Response('asset') },
    outboundService: async req => {
      const u = req.url;
      mundo.fetchesExternos.push(u);
      if (u.startsWith('https://push.test/')) { mundo.pushes.push({ url: u, headers: Object.fromEntries(req.headers) }); return new Response('', { status: 201 }); }
      if (u.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(mundo.geminiReply) }] } }] }), { status: 200 });
      }
      if (mundo.externo.has(u)) return mundo.externo.get(u)();
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
  mundo.cron = async () => { const w = await mundo.mf.getWorker(); await w.scheduled(); };
  mundo.cerrar = () => mundo.mf.dispose();
  return mundo;
}
