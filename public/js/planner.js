// Planificación: bloques del horario, "¿qué hago ahora?", lectura de notas sin IA y recordatorios.
import { state } from './store.js';
import { dayKey, addDays, atTime, daysBetween, uid, defaultEnd, validHm } from './util.js';
import { huecos, opcionesHueco } from './huecos.js';

export const AREAS = {
  estudios: { label: 'Estudios', emoji: '📚' },
  entreno: { label: 'Entreno', emoji: '🏋️' },
  pega: { label: 'Pega', emoji: '💼' },
  casa: { label: 'Casa y trámites', emoji: '🏠' },
  plata: { label: 'Plata', emoji: '💸' },
  personal: { label: 'Personal', emoji: '✨' },
};

export const KINDS = {
  clase: { label: 'Clase', emoji: '🎓' },
  entreno: { label: 'Entreno', emoji: '🏋️' },
  pega: { label: 'Pega', emoji: '💼' },
  otro: { label: 'Otro', emoji: '📌' },
  cal: { label: 'Calendario', emoji: '📅' },
};

// Bloques de un día concreto, con fechas reales de inicio y fin: horario semanal,
// eventos de una sola vez y eventos importados del calendario.
export function blocksFor(date) {
  const dow = date.getDay();
  const k = dayKey(date);
  const own = state.schedule.filter(b => (b.date ? b.date === k : b.days.includes(dow)));
  const ext = (state.extEvents || []).filter(e => e.date === k && !e.allDay && e.start && e.end)
    .map(e => ({ id: `ext-${k}-${e.start}-${e.title}`.replace(/\W+/g, ''), title: e.title, kind: 'cal', start: e.start, end: e.end, ext: true }));
  return [...own, ...ext]
    .map(b => ({ ...b, startAt: atTime(date, b.start), endAt: atTime(date, b.end) }))
    .sort((a, b) => a.startAt - b.startAt);
}

// Tiempo libre de un día (ver huecos.js), con la ventana y el mínimo de Ajustes.
export const huecosDel = date => huecos(blocksFor(date), opcionesHueco(state.settings, date.getDay()));

// El hueco en que estás o el próximo de hoy. Si ya empezó, cuenta desde ahora (y debe seguir alcanzando).
export function proximoHueco(now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const { min } = opcionesHueco(state.settings, now.getDay());
  for (const h of huecosDel(now)) {
    const ini = Math.max(h.ini, nowMin);
    if (h.fin - ini >= min) return { ...h, ini, min: h.fin - ini, ahora: h.ini <= nowMin };
  }
  return null;
}

export const allDayFor = date => (state.extEvents || []).filter(e => e.date === dayKey(date) && e.allDay);

// Qué está pasando ahora y qué viene (busca hasta 7 días adelante).
export function nowAndNext(now = new Date()) {
  const current = blocksFor(now).find(b => b.startAt <= now && b.endAt > now) || null;
  let next = null;
  for (let i = 0; i < 7 && !next; i++) {
    next = blocksFor(addDays(now, i)).find(b => b.startAt > now) || null;
  }
  return { current, next };
}

export function openTasks() {
  return state.tasks.filter(t => !t.done);
}

// Puntaje para elegir UNA tarea: urgencia, si ya partiste, y si cabe en el tiempo libre.
function score(t, freeMin) {
  let s = 0;
  if (t.today) s += 50;
  if (t.due) {
    const d = daysBetween(dayKey(), t.due);
    if (d < 0) s += 80;
    else if (d === 0) s += 60;
    else if (d === 1) s += 35;
    else if (d <= 3) s += 20;
    else if (d <= 7) s += 10;
  }
  if (t.steps?.some(x => x.done) || t.focusMs > 0) s += 15;
  if (freeMin != null) s += (t.minutes || 25) <= freeMin ? 10 : -10;
  s -= (t.skips || 0) * 3;
  // Con poca energía conviene algo corto; con mucha, lo grande.
  const energy = currentEnergy();
  if (energy != null && energy <= 2) s += (t.minutes || 25) <= 15 ? 15 : (t.minutes || 25) >= 45 ? -10 : 0;
  if (energy != null && energy >= 4 && (t.minutes || 25) >= 45) s += 8;
  return s;
}

// Energía del último check-in si fue hace menos de 5 horas.
function currentEnergy() {
  const last = state.mood?.[0];
  return last && Date.now() - last.t < 5 * 3600000 ? last.energy : null;
}

export function suggestTask(skipIds = []) {
  const { current, next } = nowAndNext();
  const freeMin = current ? null : next ? (next.startAt - Date.now()) / 60000 : null;
  const pinned = state.tasks.find(t => t.id === state.currentTaskId && !t.done);
  if (pinned && !skipIds.includes(pinned.id)) return pinned;
  const list = openTasks().filter(t => !skipIds.includes(t.id));
  list.sort((a, b) => score(b, freeMin) - score(a, freeMin) || a.createdAt - b.createdAt);
  return list[0] || null;
}

export const nextStep = t => t?.steps?.find(s => !s.done) || null;

// ---- Lectura de notas sin IA (respaldo cuando no hay servidor) ----

const AREA_WORDS = [
  ['estudios', /prueba|control|certamen|estudi|leer|lectura|ramo|clase|tarea|informe|ensayo|trabajo grupal|entrega|apunte|resumen|examen|universidad/i],
  ['entreno', /gym|gimnasio|entren|pierna|pecho|espalda|correr|cardio|proteína|rutina/i],
  ['pega', /pega|cv|curr[ií]culum|postular|entrevista|linkedin|trabajo\b/i],
  ['plata', /pagar|banco|cuenta|transfer|plata|deuda|tarjeta|cobrar|ahorr/i],
  ['casa', /limpiar|lavar|ordenar|comprar|supermercado|ropa|pieza|basura|trámite|tramite|doctor|dentista|médico|pedir hora/i],
];

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles|miercoles', 'jueves', 'viernes', 'sábado|sabado'];

// Borde de palabra que entiende tildes (\b de JS solo conoce ASCII).
const word = re => new RegExp(`(?<![\\p{L}\\d])(?:${re})(?![\\p{L}\\d])`, 'u');

// "mañana" como día, no "de la mañana" (hora).
const MANANA = '(?<!(?:de|en|por) la )mañana';
// "el 3" o "el 3 de noviembre": un día del mes (no "el 3 a las…" ni "el 3h").
const EL_DIA = /(?:^|\s)el\s+(\d{1,2})(?![\d:./-]|\s*(?:h\b|hrs?\b|am\b|pm\b))/i;

function detectDue(text, today = new Date()) {
  const t = text.toLowerCase();
  if (word('pasado mañana').test(t)) return dayKey(addDays(today, 2));
  if (word(MANANA).test(t)) return dayKey(addDays(today, 1));
  if (word('hoy|ahora|urgente').test(t)) return dayKey(today);
  for (let i = 0; i < 7; i++) {
    if (word(WEEKDAYS[i]).test(t)) {
      let diff = (i - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return dayKey(addDays(today, diff));
    }
  }
  const m = t.match(/(?<![\d.:])(\d{1,2})[/-](\d{1,2})(?![\d:])/);
  if (m) {
    const d = new Date(today.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (d < addDays(today, -1)) d.setFullYear(d.getFullYear() + 1);
    return dayKey(d);
  }
  const el = t.match(EL_DIA);
  if (el && Number(el[1]) >= 1 && Number(el[1]) <= 31) {
    const d = new Date(today.getFullYear(), today.getMonth(), Number(el[1]));
    if (d < addDays(today, -1)) d.setMonth(d.getMonth() + 1);
    return dayKey(d);
  }
  return null;
}

// ---- Hora del día ----
// Formas: "15:00", "a las 15.30", "3pm", "a las 3", "a las 8 y media", "a las 9 de la noche", "15h", "20 hrs",
// y rangos "15:00 - 16:30" o "8:30 a 10:00". Una duración ("2h", "8 hrs") no es hora: solo 12h–23h valen sin "a las".
const PRE = '(?:a\\s+las?\\s+)?';
const SUF = '(?:\\s*(?:h|hrs?|horas?)(?![\\p{L}\\d]))?';
const PARTE = '(?:\\s+de\\s+la\\s+(mañana|tarde|noche))?';
const HM = '([01]?\\d|2[0-3])\\s*:\\s*([0-5]\\d)';
const TIME_RES = [
  // rango con minutos: "15:00 - 16:30", "8:30 a 10:00", "de 15:00 a 16:00"
  { re: new RegExp(`(?:de\\s+)?${PRE}(?<![\\d:.])${HM}${SUF}\\s*(?:-|–|a|al|hasta)\\s*${HM}${SUF}`, 'iu'), rango: true },
  // "15:00", "a las 15:00 hrs", "a las 8.30" (con punto solo si dice "a las": "12.11" puede ser una fecha)
  { re: new RegExp(`${PRE}(?<![\\d:.])${HM}\\s*(am|pm)?${SUF}${PARTE}(?![\\d])`, 'iu') },
  { re: new RegExp(`a\\s+las?\\s+([01]?\\d|2[0-3])\\.([0-5]\\d)\\s*(am|pm)?${SUF}${PARTE}(?![\\d])`, 'iu') },
  // "3pm", "a las 9 am"
  { re: new RegExp(`${PRE}(?<![\\d:.])(1[0-2]|0?[1-9])()\\s*(am|pm)(?![\\p{L}])`, 'iu') },
  // "a las 3", "a las 8 y media", "a la 1 y cuarto", "a las 9 de la noche"
  { re: new RegExp(`a\\s+las?\\s+([01]?\\d|2[0-3])(?:\\s+y\\s+(media|cuarto|[0-5]\\d))?()${SUF}${PARTE}(?![\\d:.])`, 'iu'), suelta: true },
  // "15h", "20 hrs": solo de 12 a 23 (antes de eso es una duración)
  { re: new RegExp(`(?<![\\d:.])(1[2-9]|2[0-3])()()\\s*(?:h|hrs?)(?![\\p{L}\\d])`, 'iu') },
];

const hm2 = (h, m) => validHm(`${h}:${String(m).padStart(2, '0')}`);

export function detectTime(text) {
  for (const { re, rango, suelta } of TIME_RES) {
    const m = text.match(re);
    if (!m) continue;
    if (rango) {
      const start = hm2(Number(m[1]), Number(m[2]));
      const end = hm2(Number(m[3]), Number(m[4]));
      if (start && end && end > start) return { hm: start, end, found: m[0] };
      continue;
    }
    let h = Number(m[1]);
    const min = m[2] === 'media' ? 30 : m[2] === 'cuarto' ? 15 : Number(m[2]) || 0;
    const ap = (m[3] || '').toLowerCase();
    const parte = (m[4] || '').toLowerCase();
    if ((ap === 'pm' || parte === 'tarde' || parte === 'noche') && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    // "a las 3" sin más es en la tarde: nadie anota un evento a las 3 de la madrugada.
    if (suelta && !ap && !parte && h >= 1 && h <= 6) h += 12;
    const hm = hm2(h, min);
    if (hm) return { hm, found: m[0] };
  }
  return null;
}

function detectMinutes(text) {
  const m = text.match(/(\d+)\s*(min|m\b|h|hr|hora)/i);
  if (!m) return 25;
  const n = Number(m[1]);
  return /h/i.test(m[2]) ? n * 60 : n;
}

const DAY_WORDS = `pasado mañana|${MANANA}|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo`;

// Saca del título lo que ya quedó como fecha u hora ("dentista el jueves a las 15:00" → "Dentista").
function cleanTitle(line, found, hasDate) {
  let t = found ? line.replace(found, ' ') : line;
  if (hasDate) {
    t = t.replace(new RegExp(`(?:(?:el|este|para el|para)\\s+)?(?<![\\p{L}\\d])(?:${DAY_WORDS})(?![\\p{L}\\d])`, 'iu'), ' ')
      .replace(/(?:\bel\s+)?(?<![\d.:])\d{1,2}[/-]\d{1,2}(?![\d:])/i, ' ')
      .replace(EL_DIA, ' ');
  }
  t = t.replace(/\s+(?:el|a la|a las|para el|para|este)\s*$/i, '').replace(/^(?:a las?|el)\s+/i, '').replace(/\s+([,.;])/g, '$1').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// ahora: cuándo se dijo (el Atajo puede haberse dictado ayer): "mañana" y "a las 9" se cuentan desde ahí.
export function localParse(text, ahora = new Date()) {
  return text
    // Una idea por línea, por ";", "•" o coma (el dictado llega en una sola línea con comas). El guion separa
    // solo si no está entre horas ("15:00 - 16:30" es un rango).
    .split(/\n|;|•|,(?!\d)|(?:^|\s)-\s(?!\d)/)
    .map(s => s.trim().replace(/^(?:[-*•)]\s*|\d+\s*[.)]-?\s+)/, ''))
    .filter(s => s.length > 2)
    .map(line => {
      const time = detectTime(line);
      const due = detectDue(line, ahora);
      if (time) {
        // Con hora es un evento: sin fecha, hoy (o mañana si la hora ya pasó).
        const now = ahora;
        const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const date = due || dayKey(time.hm > nowHm ? now : addDays(now, 1));
        return { kind: 'evento', title: cleanTitle(line, time.found, !!due) || 'Evento', date, start: time.hm, end: time.end || defaultEnd(time.hm) };
      }
      return {
        title: (due && cleanTitle(line, '', true)) || line.charAt(0).toUpperCase() + line.slice(1),
        area: (AREA_WORDS.find(([, re]) => re.test(line)) || ['personal'])[0],
        minutes: detectMinutes(line),
        due,
      };
    });
}

export function fallbackSteps(task) {
  const base = {
    estudios: [
      ['Abre el material y déjalo a la vista', 1],
      ['Mira solo el primer punto o página', 5],
      ['Anota 3 ideas clave con tus palabras', 5],
      ['Sigue con el siguiente punto', 10],
      ['Anota qué falta para la próxima vez', 2],
    ],
    casa: [
      ['Junta lo que necesitas en un solo lugar', 2],
      ['Haz la parte más visible primero', 5],
      ['Sigue con lo que queda', 10],
      ['Guarda todo y revisa', 3],
    ],
  }[task.area] || [
    ['Prepara lo que necesitas', 1],
    ['Haz la parte más fácil primero', 5],
    ['Sigue con el siguiente pedazo', 10],
    ['Revisa y cierra', 3],
  ];
  return base.map(([text, min]) => ({ id: uid(), text, min, done: false }));
}

// ---- Número en el ícono ----
// Los avisos los calcula el servidor (src/avisos.js). Esta regla es la misma que usa él para el número: pendientesDel().
export const pendientesHoy = () => state.tasks.filter(t => !t.done && (t.due ? t.due <= dayKey() : !!t.today)).length;
