// "Más": acceso a todos los módulos, cada uno con su estado en una línea.
import { state } from '../store.js';
import { levelInfo, shieldDays } from '../game.js';
import { dayKey, daysBetween } from '../util.js';
import { challengeSummary } from '../challenges.js';

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

function weekSpent() {
  const d = new Date();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
  return state.money.expenses.filter(e => e.t >= monday).reduce((a, e) => a + e.amount, 0);
}

function nextExam() {
  const e = state.exams.filter(x => !x.done && x.date >= dayKey()).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!e) return 'Sin evaluaciones próximas';
  const d = daysBetween(dayKey(), e.date);
  return `${e.title} ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}`;
}

export function render() {
  const lv = levelInfo();
  const routinesDone = Object.keys(state.routineLog[dayKey()] || {}).length;
  const lastMood = state.mood[0];
  const ch = challengeSummary();
  const activeGoals = state.goals.filter(g => !g.done).length;
  const tiles = [
    ['tareas', '📋', 'Tareas', `${state.tasks.filter(t => !t.done).length} pendientes`],
    ['metas', '🎯', 'Metas', activeGoals ? `${activeGoals} activa${activeGoals > 1 ? 's' : ''}` : 'Crea tu primera meta'],
    ['garage', '🏎️', 'Garage', ch.ready ? `🏁 ${ch.ready} desafío${ch.ready > 1 ? 's' : ''} por cobrar` : `Nivel ${lv.lvl} · ⛽ ${state.game.fuel}`],
    ['revision', '🧭', 'Revisión semanal', new Date().getDay() === 0 ? '¡Hoy toca!' : 'Los domingos'],
    ['rutinas', '🔄', 'Rutinas', routinesDone ? `${routinesDone} hecha${routinesDone > 1 ? 's' : ''} hoy` : 'Mañana, noche, gym'],
    ['estudios', '📚', 'Estudios', nextExam()],
    ['plata', '💸', 'Plata', `${clp(weekSpent())} esta semana`],
    ['animo', '⚡', 'Ánimo', lastMood && lastMood.day === dayKey() ? 'Check-in hecho hoy' : 'Sin check-in hoy'],
    ['escudo', '🛡️', 'Escudo', `${shieldDays()} días`],
    ['pareja', '💑', 'Pareja', state.partner.enabled ? `${state.partner.cheers.length} mensajes` : 'Compartir avance'],
    ['ajustes', '⚙️', 'Ajustes', 'Servidor, avisos, respaldo'],
  ];
  return `<header class="top"><h1>Más</h1></header>
    <div class="hub">${tiles.map(([to, icon, name, sub]) => `<button class="tile" data-act="go" data-to="${to}">
      <span class="tile-icon">${icon}</span><b>${name}</b><span class="muted tiny">${sub}</span></button>`).join('')}</div>`;
}
