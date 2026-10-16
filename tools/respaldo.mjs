// Descarga tus datos desde el servidor a un JSON local. Úsalo ANTES de cualquier cambio de formato.
// Uso: npm run respaldo   (pide la dirección y la clave; o TURBO_URL y TURBO_SECRET)
// Los archivos quedan en respaldos/ (fuera de git: son datos personales).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export async function exportar({ url, secret, dir = 'respaldos', fetchFn = fetch, ahora = new Date() }) {
  const base = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('La dirección debe empezar con https:// (ej. https://turbo.tu-subdominio.workers.dev)');
  const res = await fetchFn(`${base}/api/state`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error('La clave (APP_SECRET) no coincide con la del servidor.');
  if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
  const datos = await res.json();
  if (!datos?.state || !Array.isArray(datos.state.tasks)) {
    throw new Error('El servidor no tiene respaldo todavía (abre la app con la clave puesta para que suba uno). No se guardó nada.');
  }
  const p = n => String(n).padStart(2, '0');
  const nombre = `turbo-${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}-${p(ahora.getHours())}${p(ahora.getMinutes())}.json`;
  await mkdir(dir, { recursive: true });
  const ruta = join(dir, nombre);
  await writeFile(ruta, JSON.stringify(datos, null, 2));
  return { ruta, tareas: datos.state.tasks.length, hábitos: (datos.state.habits || []).length, updatedAt: datos.updatedAt };
}

function preguntar(texto, oculto = false) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = s => { if (s.includes(texto)) rl.output.write(s); };
    rl.question(texto, r => { if (oculto) process.stdout.write('\n'); rl.close(); resolve(r); });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const url = process.env.TURBO_URL || await preguntar('Dirección de Turbo: ');
    const secret = process.env.TURBO_SECRET || await preguntar('Clave (APP_SECRET, no se ve ni se guarda): ', true);
    const r = await exportar({ url, secret });
    console.log(`Listo: ${r.ruta} (${r.tareas} tareas, ${r.hábitos} hábitos).`);
  } catch (e) {
    console.error(`No se pudo: ${e.message}`);
    process.exit(1);
  }
}
