// Puente con Google Calendar (vía Apps Script, ver public/puente-google.txt y docs/GOOGLE.md).
// Funciones puras: qué crear o borrar en Google, qué cambió allá y cómo se ve el estado con eso aplicado.
// El servidor no escribe en el estado de la app: guarda su propio mapa { idTurbo: idGoogle } en kv 'puente'.
import { keyOf, keyToNum } from './tiempo.js';

export const DIAS_ATRAS = 1;
export const DIAS_ADELANTE = 60;
const MAX_EVENTOS = 3000;
const esHm = s => /^\d{2}:\d{2}$/.test(s || '');
const esDia = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export const rango = hoy => ({ desde: keyOf(hoy - DIAS_ATRAS), hasta: keyOf(hoy + DIAS_ADELANTE) });

// Lo que devuelve el Apps Script ({dia1, hora1, dia2, hora2} en hora de Chile) → eventos de un día,
// como los del link iCal: { title, date, start, end, allDay }, más turboId si nació en Turbo.
// Los que cruzan la medianoche se parten por día. Los de duración cero no ocupan tiempo: se ignoran.
export function normalizar(crudos = []) {
  const out = [];
  for (const e of Array.isArray(crudos) ? crudos : []) {
    if (!e || !esDia(e.dia1) || out.length >= MAX_EVENTOS) continue;
    const base = { title: String(e.title || '(sin título)'), ...(e.turboId ? { turboId: String(e.turboId), gid: String(e.gid || '') } : {}) };
    const d1 = keyToNum(e.dia1);
    if (e.allDay) {
      const z = esDia(e.dia2) && keyToNum(e.dia2) > d1 ? keyToNum(e.dia2) : d1 + 1; // fin exclusivo
      for (let d = d1; d < z && d < d1 + DIAS_ADELANTE + 2; d++) out.push({ ...base, date: keyOf(d), allDay: true });
      continue;
    }
    if (!esHm(e.hora1) || !esDia(e.dia2) || !esHm(e.hora2)) continue;
    const d2 = keyToNum(e.dia2);
    if (d2 < d1 || (d2 === d1 && e.hora2 <= e.hora1)) continue;
    const ultimo = e.hora2 === '00:00' ? d2 - 1 : d2; // termina justo a medianoche: no ocupa el día siguiente
    for (let d = d1; d <= ultimo && d < d1 + DIAS_ADELANTE + 2; d++) {
      out.push({ ...base, date: keyOf(d), start: d === d1 ? e.hora1 : '00:00', end: d === d2 ? e.hora2 : '23:59', allDay: false });
    }
  }
  return out;
}

// Lo de Turbo que va a Google: todo lo que tiene día y hora (los bloques de una vez), desde hoy.
const sincronizable = (b, hoy) => b && b.id && esDia(b.date) && esHm(b.start) && esHm(b.end)
  && keyToNum(b.date) >= hoy && keyToNum(b.date) <= hoy + DIAS_ADELANTE;

// Qué crear y qué borrar en Google, sin leerlo: alcanza con el estado y el mapa.
export function paraGoogle({ state = {}, mapa = {}, hoy }) {
  const borrados = new Set(state.calBorrados || []);
  const crear = (state.schedule || [])
    .filter(b => sincronizable(b, hoy) && !(b.id in mapa) && !borrados.has(b.id))
    .map(b => ({ id: b.id, title: String(b.title || 'Turbo'), dia: b.date, inicio: b.start, fin: b.end > b.start ? b.end : '23:59' }));
  const borrar = [...borrados].filter(id => mapa[id]).map(id => ({ id, gid: mapa[id] }));
  return { crear, borrar };
}

// Después de escribir en Google: el mapa nuevo.
export function anotarEscritura(mapa, { creados = {}, borrados = [] } = {}, borrar = []) {
  const m = { ...mapa, ...creados };
  const listos = new Set(borrados);
  for (const b of borrar) if (listos.has(b.gid)) delete m[b.id];
  return m;
}

// Compara lo leído en Google con lo de Turbo. Google manda: si movió o borró algo que nació en Turbo,
// Turbo lo sigue (cambios). Los eventos de Turbo no se devuelven como eventos de Google: así nada sale doble.
export function reconciliar({ state = {}, mapa = {}, google = [], hoy }) {
  const items = new Map((state.schedule || []).map(b => [b.id, b]));
  const borradosTurbo = new Set(state.calBorrados || []);
  const deTurbo = new Map();
  for (const e of google) if (e.turboId && !deTurbo.has(e.turboId)) deTurbo.set(e.turboId, e);

  const m = { ...mapa };
  const cambios = [];
  // Eventos con marca de Turbo que el mapa no conocía (p. ej. se cortó la conexión justo al crear).
  for (const [id, g] of deTurbo) if (!m[id] && g.gid && (items.has(id) || borradosTurbo.has(id))) m[id] = g.gid;

  for (const id of Object.keys(m)) {
    const item = items.get(id);
    const g = deTurbo.get(id);
    if (!item) {
      if (!g && !borradosTurbo.has(id)) delete m[id]; // ya no está en ningún lado
      continue;
    }
    if (g) {
      const nuevo = { title: g.title, date: g.date, start: g.start, end: g.end };
      if (g.allDay) continue; // lo pasaron a "todo el día" en Google: se deja como estaba en Turbo
      if (nuevo.title !== item.title || nuevo.date !== item.date || nuevo.start !== item.start || nuevo.end !== item.end) cambios.push({ id, ...nuevo });
    } else if (m[id] === null || sincronizable(item, hoy - DIAS_ATRAS)) {
      // Estaba en Google, dentro de lo que se leyó, y ya no está: lo borró allá.
      cambios.push({ id, borrar: true });
      m[id] = null; // queda marcado para no volver a crearlo mientras la app no lo saque
    }
  }
  const eventos = google.filter(e => !e.turboId);
  return { eventos, cambios, mapa: m };
}

// El estado con los cambios de Google aplicados: lo usan los avisos del cron y la app.
export function aplicarCambios(state = {}, cambios = []) {
  if (!cambios.length) return state;
  const porId = new Map(cambios.map(c => [c.id, c]));
  const schedule = [];
  for (const b of state.schedule || []) {
    const c = porId.get(b.id);
    if (!c) schedule.push(b);
    else if (!c.borrar) schedule.push({ ...b, title: c.title, date: c.date, start: c.start, end: c.end });
  }
  return { ...state, schedule };
}

// Huella corta para saber si algo cambió (y no escribir en D1 ni replanificar por nada).
export function huella(x) {
  let h = 5381;
  for (const c of JSON.stringify(x)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
