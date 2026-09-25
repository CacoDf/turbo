// Planificación: bloques del horario, "¿qué hago ahora?", lectura de notas sin IA y recordatorios.
import { state } from './store.js';
import { dayKey, addDays, atTime, daysBetween, uid } from './util.js';

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

function detectDue(text) {
  const t = text.toLowerCase();
  const today = new Date();
  if (/pasado mañana/.test(t)) return dayKey(addDays(today, 2));
  if (/\bmañana\b/.test(t)) return dayKey(addDays(today, 1));
  if (/\bhoy\b|ahora|urgente/.test(t)) return dayKey(today);
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(${WEEKDAYS[i]})\\b`).test(t)) {
      let diff = (i - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return dayKey(addDays(today, diff));
    }
  }
  const m = t.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (m) {
    const d = new Date(today.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (d < addDays(today, -1)) d.setFullYear(d.getFullYear() + 1);
    return dayKey(d);
  }
  return null;
}

function detectMinutes(text) {
  const m = text.match(/(\d+)\s*(min|m\b|h|hr|hora)/i);
  if (!m) return 25;
  const n = Number(m[1]);
  return /h/i.test(m[2]) ? n * 60 : n;
}

export function localParse(text) {
  return text
    .split(/\n|;|•|(?:^|\s)-\s/)
    .map(s => s.trim().replace(/^[\d.)\-*\s]+/, ''))
    .filter(s => s.length > 2)
    .map(line => ({
      title: line.charAt(0).toUpperCase() + line.slice(1),
      area: (AREA_WORDS.find(([, re]) => re.test(line)) || ['personal'])[0],
      minutes: detectMinutes(line),
      due: detectDue(line),
    }));
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

// ---- Recordatorios que el servidor manda como notificación (próximas 36 h) ----

export function computeReminders() {
  const out = [];
  const now = Date.now();
  const horizon = now + 36 * 3600000;
  const s = state.settings;
  for (let i = 0; i < 2; i++) {
    const day = addDays(new Date(), i);
    for (const b of blocksFor(day)) {
      const at = b.startAt.getTime() - s.remindBefore * 60000;
      if (at > now && at < horizon) {
        out.push({ id: `blk-${b.id}-${dayKey(day)}`, at, title: `${KINDS[b.kind]?.emoji || '📌'} ${b.title} en ${s.remindBefore} min`, body: `Parte a las ${b.start}. Deja lo que estás haciendo en un punto fácil de retomar.` });
      }
    }
    const morning = atTime(day, s.morningAt).getTime();
    if (morning > now && morning < horizon) {
      const n = openTasks().length;
      out.push({ id: `morning-${dayKey(day)}`, at: morning, title: '☀️ Buenos días', body: n ? `Tienes ${n} cosas anotadas. Cuéntale a tu secretaria qué más tienes hoy.` : 'Tu secretaria te espera: cuéntale qué tienes hoy (1 minuto).' });
    }
    const habitsAt = atTime(day, s.habitsAt).getTime();
    if (habitsAt > now && habitsAt < horizon) {
      const log = state.habitLog[dayKey(day)] || {};
      const pending = state.habits.filter(h => !h.archived && (log[h.id] || 0) < h.target);
      if (pending.length) out.push({ id: `habits-${dayKey(day)}`, at: habitsAt, title: '✅ Revisa tus hábitos', body: `Te faltan: ${pending.map(h => h.emoji + ' ' + h.name).join(', ')}` });
    }
  }
  for (let i = 0; i < 2; i++) {
    const day = addDays(new Date(), i);
    for (const r of state.routines || []) {
      if (!r.at || !r.days?.includes(day.getDay()) || state.routineLog?.[dayKey(day)]?.[r.id]) continue;
      const at = atTime(day, r.at).getTime();
      if (at > now && at < horizon) out.push({ id: `rt-${r.id}-${dayKey(day)}`, at, title: `${r.emoji} Rutina de ${r.name}`, body: `${r.steps.length} pasos. Abre Turbo y sigue uno a la vez.` });
    }
  }
  // Revisión semanal: domingo a la hora elegida.
  for (let i = 0; i < 2; i++) {
    const day = addDays(new Date(), i);
    if (day.getDay() !== 0) continue;
    const at = atTime(day, s.reviewAt || '19:00').getTime();
    if (at > now && at < horizon) out.push({ id: `review-${dayKey(day)}`, at, title: '🧭 Revisión semanal (5 min)', body: 'Mira cómo te fue y elige tus 3 prioridades de la semana.' });
  }
  const tomorrow = dayKey(addDays(new Date(), 1));
  for (const e of state.exams || []) {
    if (e.done || e.date !== tomorrow) continue;
    const at = atTime(new Date(), '20:00').getTime();
    if (at > now) out.push({ id: `exam-${e.id}`, at, title: '📚 Mañana tienes evaluación', body: `${e.title}. Repaso corto y a dormir temprano.` });
  }
  for (const t of openTasks()) {
    if (t.due === dayKey(addDays(new Date(), 1))) {
      const at = atTime(new Date(), '19:00').getTime();
      if (at > now) out.push({ id: `due-${t.id}`, at, title: '⏰ Mañana vence algo', body: t.title });
    }
  }
  if (state.focus && state.focus.endAt > now) {
    out.push({ id: 'focus-end', at: state.focus.endAt, title: '🏁 ¡Tiempo!', body: 'Terminó tu sesión de foco. ¿Cómo te fue?' });
  }
  return out;
}
