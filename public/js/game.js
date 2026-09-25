// Juego: XP, niveles (autos del garage), bencina para premios, rachas con comodín.
import { state, update } from './store.js';
import { dayKey, addDays, daysBetween, parseDayKey } from './util.js';

export const CARS = [
  { name: 'Fiat 600', hp: 22, color: '#d9c7a3' },
  { name: 'Suzuki Alto', hp: 67, color: '#9fb7c9' },
  { name: 'Chevrolet Spark', hp: 80, color: '#b7d38a' },
  { name: 'Toyota Yaris', hp: 106, color: '#e8e8e8' },
  { name: 'Mazda 3', hp: 155, color: '#c0504d' },
  { name: 'Volkswagen Golf', hp: 150, color: '#7f9bb3' },
  { name: 'Honda Civic Si', hp: 200, color: '#e36b4b' },
  { name: 'Mini Cooper S', hp: 189, color: '#6aa36f' },
  { name: 'Subaru Impreza WRX', hp: 271, color: '#3f6fcf' },
  { name: 'Volkswagen Golf GTI', hp: 241, color: '#d64545' },
  { name: 'Toyota GR86', hp: 228, color: '#f0f0f0' },
  { name: 'Mazda MX-5 Miata', hp: 181, color: '#b8323c' },
  { name: 'Ford Mustang GT', hp: 480, color: '#f2b84b' },
  { name: 'Nissan 350Z', hp: 306, color: '#e0852e' },
  { name: 'Mitsubishi Lancer Evo IX', hp: 286, color: '#dcdcdc' },
  { name: 'Toyota Supra MK4', hp: 320, color: '#f28c28' },
  { name: 'Nissan Skyline GT-R R34', hp: 276, color: '#4a7fd6' },
  { name: 'BMW M3 E46', hp: 338, color: '#5b8fa8' },
  { name: 'Audi RS6 Avant', hp: 621, color: '#8a9099' },
  { name: 'Chevrolet Corvette C8', hp: 495, color: '#e8c33a' },
  { name: 'Porsche 911 GT3', hp: 502, color: '#9ccf6a' },
  { name: 'Lamborghini Huracán', hp: 631, color: '#b6e04a' },
  { name: 'Ferrari F40', hp: 471, color: '#e33b2e' },
  { name: 'McLaren P1', hp: 903, color: '#f5902a' },
  { name: 'Bugatti Chiron', hp: 1500, color: '#2f5fa8' },
];

// XP acumulada necesaria para llegar a cada nivel: 0, 100, 300, 600, 1000...
export const xpForLevel = lvl => 50 * (lvl - 1) * lvl;

export function levelInfo(xp = state.game.xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  const base = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  const car = CARS[Math.min(lvl, CARS.length) - 1];
  return { lvl, car, into: xp - base, need: next - base, pct: (xp - base) / (next - base) };
}

export const XP = {
  focusStart: 10,
  focusPer5: 5,
  step: 5,
  taskBase: 20,
  habit: 10,
  allHabits: 25,
  capture: 5,
  shieldWin: 50,
  shieldLog: 10,
  routine: 20,
  expense: 3,
  wishSkip: 15,
  mood: 3,
  studyPlan: 10,
  assistant: 5,
  review: 40,
  challenge: 150,
};

// Suma XP y bencina. Devuelve info de subida de nivel para celebrar.
export function award(xp, type, text) {
  const before = levelInfo().lvl;
  update(s => {
    s.game.xp += xp;
    s.game.fuel += xp;
    s.game.log.unshift({ t: Date.now(), day: dayKey(), type, xp, text });
    if (s.game.log.length > 400) s.game.log.length = 400;
  });
  if (type !== 'shield') markActiveDay();
  const after = levelInfo().lvl;
  return { xp, levelUp: after > before ? after : null };
}

export function todayWins() {
  const k = dayKey();
  return state.game.log.filter(e => e.day === k);
}

// Lunes de la semana de una fecha, para entregar 1 comodín por semana.
function weekKey(d = new Date()) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  return dayKey(addDays(x, -dow));
}

// Se llama al abrir la app: revisa días perdidos y usa comodines antes de cortar la racha.
export function checkStreak() {
  update(s => {
    const st = s.game.streak;
    const wk = weekKey();
    if (st.freezeWeek !== wk) {
      st.freezes = Math.min(2, (st.freezes || 0) + (st.freezeWeek ? 1 : 0));
      st.freezeWeek = wk;
    }
    if (!st.lastDay) return;
    const gap = daysBetween(st.lastDay, dayKey());
    if (gap <= 1) return;
    const missed = gap - 1;
    if (missed <= st.freezes) {
      st.freezes -= missed;
      st.lastDay = dayKey(addDays(new Date(), -1));
    } else {
      st.current = 0;
    }
  }, { silent: true });
}

export function markActiveDay() {
  const k = dayKey();
  if (state.game.streak.lastDay === k) return;
  update(s => {
    const st = s.game.streak;
    const gap = st.lastDay ? daysBetween(st.lastDay, k) : 1;
    st.current = gap === 1 ? st.current + 1 : 1;
    st.best = Math.max(st.best, st.current);
    st.lastDay = k;
  });
}

// Racha de un hábito: días seguidos cumpliendo la meta (hoy cuenta solo si ya se cumplió).
export function habitStreak(h) {
  let n = 0;
  let d = new Date();
  const done = k => (state.habitLog[k]?.[h.id] || 0) >= h.target;
  if (!done(dayKey(d))) d = addDays(d, -1);
  while (done(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function habitsDoneToday() {
  const log = state.habitLog[dayKey()] || {};
  const list = state.habits.filter(h => !h.archived);
  return { done: list.filter(h => (log[h.id] || 0) >= h.target).length, total: list.length };
}

// Días desde el último desliz (o desde que empezó a usar el Escudo).
export function shieldDays() {
  return Math.max(0, daysBetween(dayKey(new Date(state.shield.since)), dayKey()));
}

export function lastDays(n) {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(new Date(), i - n + 1)));
}

export const shortDay = k => ['D', 'L', 'M', 'M', 'J', 'V', 'S'][parseDayKey(k).getDay()];
