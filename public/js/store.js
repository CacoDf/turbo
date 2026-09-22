// Estado de la app: vive en localStorage (funciona sin internet) y se respalda en el servidor.
import { uid, dayKey } from './util.js';

const KEY = 'turbo.v1';

function defaultState() {
  const now = Date.now();
  return {
    version: 1,
    settings: {
      secret: '',
      notif: false,
      remindBefore: 15, // minutos antes de cada bloque del horario
      morningAt: '09:00',
      habitsAt: '21:00',
    },
    schedule: [
      { id: uid(), title: 'Clases', kind: 'clase', days: [2, 3], start: '08:30', end: '11:30' },
      { id: uid(), title: 'Clases', kind: 'clase', days: [5], start: '08:30', end: '14:10' },
    ],
    tasks: [],
    currentTaskId: null,
    habits: [
      { id: uid(), name: 'Tomar agua', emoji: '💧', target: 8, unit: 'vasos' },
      { id: uid(), name: 'Entrenar o moverme', emoji: '🏋️', target: 1 },
      { id: uid(), name: 'Un bloque de estudio', emoji: '📚', target: 1 },
      { id: uid(), name: '10 min de orden', emoji: '🧹', target: 1 },
      { id: uid(), name: 'Acostarme antes de las 00:30', emoji: '🛏️', target: 1 },
    ],
    habitLog: {}, // { 'YYYY-MM-DD': { habitId: cantidad } }
    game: {
      xp: 0,
      fuel: 0,
      log: [], // { t, day, type, xp, text }
      streak: { current: 0, best: 0, lastDay: null, freezes: 1, freezeWeek: null },
    },
    rewards: [
      { id: uid(), name: 'Un capítulo de serie', emoji: '📺', cost: 80 },
      { id: uid(), name: '30 min de YouTube', emoji: '▶️', cost: 50 },
      { id: uid(), name: 'Algo rico para comer', emoji: '🍔', cost: 150 },
      { id: uid(), name: 'Tarde libre sin culpa', emoji: '😎', cost: 400 },
    ],
    redemptions: [],
    focus: null, // { taskId, start, endAt, plannedMin, xpTicks }
    shield: { since: now, best: 0, events: [], guide: {} },
    meta: { createdAt: now, updatedAt: now, onboarded: false },
  };
}

// Completa campos que falten cuando cambia la estructura entre versiones.
function migrate(s) {
  const d = defaultState();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.settings = { ...d.settings, ...s.settings };
  s.game = { ...d.game, ...s.game, streak: { ...d.game.streak, ...(s.game?.streak || {}) } };
  s.shield = { ...d.shield, ...s.shield };
  s.meta = { ...d.meta, ...s.meta };
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudo leer el estado guardado', e);
  }
  return defaultState();
}

export let state = load();
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('No se pudo guardar', e);
  }
}

// Única forma de modificar el estado: update(s => { ... }).
export function update(fn, { silent = false } = {}) {
  fn(state);
  state.meta.updatedAt = Date.now();
  persist();
  if (!silent) listeners.forEach(l => l(state));
}

// Reemplaza el estado completo (restaurar respaldo o datos del servidor).
export function replaceState(next) {
  state = migrate(next);
  persist();
  listeners.forEach(l => l(state));
}

export function resetState() {
  state = defaultState();
  persist();
  listeners.forEach(l => l(state));
}

export const todayLog = () => state.habitLog[dayKey()] || {};
