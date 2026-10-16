// Descarga tus datos desde el servidor a un JSON local. Úsalo ANTES de cualquier cambio de formato.
// Uso: npm run respaldo   (pide la dirección y la clave; o TURBO_URL y TURBO_SECRET)
// Los archivos quedan en respaldos/ (fuera de git: son datos personales).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export async function exportar({ url, secret, dir = 'respaldos', fetchFn = fetch, ahora = new Date() }) {
  const base = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) throw new Error('La dirección debe empezar con https:// (ej. https://turbo.tu-subdominio.workers.dev): la clave no puede viajar sin cifrar.');
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
  const horas = datos.updatedAt ? (ahora.getTime() - datos.updatedAt) / 3600000 : null;
  return { ruta, horas, tareas: datos.state.tasks.length, hábitos: (datos.state.habits || []).length, updatedAt: datos.updatedAt };
}

function preguntar(texto, oculto = false) {
  if (!oculto || !process.stdin.isTTY) {
    return new Promise(resolve => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(texto, r => { rl.close(); resolve(r); });
    });
  }
  // Lectura letra por letra sin mostrar nada (ni al pegar ni al borrar).
  return new Promise((resolve, reject) => {
    let valor = '';
    process.stdout.write(texto);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const fin = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', onData); process.stdout.write('\n'); };
    const onData = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { fin(); return resolve(valor); }
        if (c === '\u0003') { fin(); return reject(new Error('Cancelado.')); }
        if (c === '\u007f' || c === '\b') valor = valor.slice(0, -1);
        else valor += c;
      }
    };
    process.stdin.on('data', onData);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const url = process.env.TURBO_URL || await preguntar('Dirección de Turbo: ');
    const secret = process.env.TURBO_SECRET || await preguntar('Clave (APP_SECRET, no se ve ni se guarda): ', true);
    const r = await exportar({ url, secret });
    console.log(`Listo: ${r.ruta} (${r.tareas} tareas, ${r.hábitos} hábitos).`);
    if (r.horas !== null && r.horas > 24) console.warn(`⚠️  Ojo: este respaldo del servidor es de hace ${Math.round(r.horas / 24)} día(s). Abre la app en el iPhone (con internet) para que suba lo último y vuelve a correr esto. Si no, en Ajustes → "Descargar respaldo" baja lo que hay en el teléfono.`);
  } catch (e) {
    console.error(`No se pudo: ${e.message}`);
    process.exit(1);
  }
}
