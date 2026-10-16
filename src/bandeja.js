// Bandeja del Atajo "Anotar en Turbo": lo dictado a Siri llega aquí sin abrir la app.
// Mientras la app no lo recoge, el servidor igual lo cuenta: los eventos salen en Google y avisan.
import { keyToNum, fromDayNum } from './tiempo.js';

export const MAX_BANDEJA = 50;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// El estado con lo de la bandeja que todavía no está (mismos ids: la app los conserva al recogerlo).
export function conBandeja(state = {}, bandeja = []) {
  const items = (bandeja || []).flatMap(e => e.items || []);
  if (!items.length) return state;
  const ids = new Set([...(state.schedule || []), ...(state.tasks || [])].map(x => x.id));
  const nuevos = items.filter(i => i.id && !ids.has(i.id));
  if (!nuevos.length) return state;
  return {
    ...state,
    schedule: [...(state.schedule || []), ...nuevos.filter(i => i.kind === 'evento')
      .map(i => ({ id: i.id, title: i.title, kind: 'otro', days: [], date: i.date, start: i.start, end: i.end, src: 'turbo' }))],
    tasks: [...(state.tasks || []), ...nuevos.filter(i => i.kind !== 'evento')
      .map(i => ({ id: i.id, title: i.title, area: i.area || 'personal', minutes: i.minutes || 25, due: i.due || null, done: false, steps: [] }))],
  };
}

const cuando = i => { const x = fromDayNum(keyToNum(i.date)); return `${DIAS[x.dow]} ${x.d} a las ${i.start}`; };

// Lo que Siri lee de vuelta: corto y sin culpa.
export function mensaje(items) {
  if (!items) return 'Anotado ✅ Lo ordeno cuando abras Turbo.';
  if (!items.length) return 'No entendí qué anotar. Prueba de nuevo.';
  if (items.length > 1) return `Anotadas ${items.length} cosas ✅`;
  const [i] = items;
  return i.kind === 'evento' ? `Anotado: ${i.title}, ${cuando(i)} ✅` : `Anotado: ${i.title} ✅`;
}
