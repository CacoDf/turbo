// Utilidades generales: fechas, ids, formato y escape de HTML.

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Fecha local en formato YYYY-MM-DD (no UTC, para que el día cambie a medianoche de Chile).
export function dayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function parseDayKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(aKey, bKey) {
  return Math.round((parseDayKey(bKey) - parseDayKey(aKey)) / 86400000);
}

export function hmToMin(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function minToHm(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function atTime(date, hm) {
  const d = new Date(date);
  const m = hmToMin(hm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDateLong(d = new Date()) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Etiqueta relativa para una fecha límite: "Hoy", "Mañana", "Atrasada 2 días", "Vie 26".
export function dueLabel(due) {
  if (!due) return '';
  const diff = daysBetween(dayKey(), due);
  if (diff < -1) return `Atrasada ${-diff} días`;
  if (diff === -1) return 'Atrasada (ayer)';
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  const d = parseDayKey(due);
  if (diff < 7) return `${DAY_SHORT[d.getDay()]} ${d.getDate()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
