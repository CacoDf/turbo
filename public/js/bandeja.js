// Lo que anotaste con el Atajo "Anotar en Turbo" (sin abrir la app) entra aquí al abrirla.
// Se conservan los ids del servidor: así lo que ya salió en Google o ya avisó no se duplica.
import { state, update } from './store.js';
import { hasServer, bandejaGet, bandejaListo } from './api.js';
import { localParse } from './planner.js';
import { addTasks, addEvents } from './actions.js';
import { toast } from './ui.js';

const esEvento = i => i.kind === 'evento';

export async function traerBandeja() {
  if (!hasServer()) return;
  try {
    const { items = [] } = await bandejaGet();
    if (!items.length) return;
    const vistos = new Set(state.bandejaVista || []);
    const nuevos = items.filter(e => !vistos.has(e.id));
    let n = 0;
    for (const e of nuevos) {
      // Sin IA en el servidor llega solo el texto: se ordena aquí, igual que en Capturar.
      const lista = e.items || localParse(e.texto || '');
      n += addEvents(lista.filter(esEvento)).length;
      addTasks(lista.filter(i => !esEvento(i)));
      n += lista.filter(i => !esEvento(i)).length;
    }
    if (nuevos.length) {
      update(s => { s.bandejaVista = [...(s.bandejaVista || []), ...nuevos.map(e => e.id)].slice(-50); });
      if (n) toast(`📥 Del Atajo: ${n === 1 ? '1 cosa anotada' : `${n} cosas anotadas`}`);
    }
    await bandejaListo(items.map(e => e.id));
  } catch (e) {
    console.warn('Bandeja', e);
  }
}
