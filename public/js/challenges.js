// Desafíos mensuales: 3 desafíos distintos cada mes (elegidos según el mes), con premio grande.
// Completar los 3 da el trofeo del mes. Así Turbo trae algo nuevo cada mes.
import { state, update } from './store.js';
import { XP } from './game.js';
import { esc, dayKey } from './util.js';
import { bar, celebrate } from './ui.js';
import { reward } from './actions.js';

const THEMES = ['Gran Premio', 'Rally', 'Drift', 'Cuarto de milla', 'Resistencia', 'Tuning', 'Road trip', 'Pit stop', 'Pole position', 'Vuelta rápida', 'Motor V8', 'Turbo máximo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const inMonth = e => e.day?.startsWith(monthKey());
const count = (type, prefix = '') => state.game.log.filter(e => inMonth(e) && e.type === type && e.text.startsWith(prefix)).length;

const POOL = [
  { id: 'focus20', emoji: '⏱️', text: '20 sesiones de foco', goal: 20, value: () => count('focus', 'Arrancaste') },
  { id: 'tasks25', emoji: '✅', text: 'Terminar 25 tareas', goal: 25, value: () => count('task') },
  { id: 'habits10', emoji: '🔁', text: '10 días con todos los hábitos', goal: 10, value: () => count('habit', 'Todos los hábitos') },
  { id: 'routines15', emoji: '🔄', text: '15 rutinas completas', goal: 15, value: () => count('routine') },
  { id: 'money20', emoji: '💸', text: 'Anotar 20 gastos', goal: 20, value: () => count('money', 'Anotaste') },
  { id: 'mood25', emoji: '⚡', text: '25 check-ins de energía', goal: 25, value: () => count('mood') },
  { id: 'assistant12', emoji: '🤖', text: 'Usar la secretaria 12 días distintos', goal: 12, value: () => new Set(state.chat.filter(m => m.role === 'user' && dayKey(new Date(m.t)).startsWith(monthKey())).map(m => dayKey(new Date(m.t)))).size },
  { id: 'goals8', emoji: '🎯', text: '8 pasos de tus metas', goal: 8, value: () => state.tasks.filter(t => t.goalId && t.done && t.doneAt && monthKey(new Date(t.doneAt)) === monthKey()).length },
  { id: 'streak14', emoji: '🔥', text: 'Llegar a una racha de 14 días', goal: 14, value: () => state.game.streak.current },
  { id: 'steps40', emoji: '👣', text: 'Completar 40 pasos chicos', goal: 40, value: () => count('step') },
];

// Elige 3 desafíos distintos según el mes (siempre los mismos para ese mes).
export function monthChallenges() {
  const d = new Date();
  const seed = d.getFullYear() * 12 + d.getMonth();
  const picked = [];
  for (let i = 0; picked.length < 3; i++) {
    const c = POOL[(seed * 7 + i * 3) % POOL.length];
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

export const monthTheme = () => `${THEMES[new Date().getMonth()]} de ${MONTHS[new Date().getMonth()]}`;

function claimedList() {
  return state.challenges.month === monthKey() ? state.challenges.claimed : [];
}

export function challengeSummary() {
  const list = monthChallenges();
  const claimed = claimedList();
  const ready = list.filter(c => c.value() >= c.goal && !claimed.includes(c.id)).length;
  return { total: list.length, claimed: claimed.length, ready };
}

export function challengesCard() {
  const claimed = claimedList();
  const list = monthChallenges();
  const trophy = state.trophies.find(t => t.month === monthKey());
  return `<section class="card challenges">
    <div class="row between"><div class="label">🏁 DESAFÍOS: ${esc(monthTheme().toUpperCase())}</div>${trophy ? '🏆' : ''}</div>
    ${list.map(c => {
      const v = Math.min(c.goal, c.value());
      const got = claimed.includes(c.id);
      return `<div class="challenge">
        <div class="row between"><span>${c.emoji} ${esc(c.text)}</span>
          ${got ? '<span class="ok">✓</span>' : v >= c.goal ? `<button class="btn small" data-act="chClaim" data-id="${c.id}">Cobrar +${XP.challenge}</button>` : `<span class="muted small">${v}/${c.goal}</span>`}
        </div>${got ? '' : bar(v / c.goal, 'var(--fuel)')}
      </div>`;
    }).join('')}
    <p class="muted tiny">Completa los 3 para ganar el trofeo del mes. Cada mes hay desafíos nuevos.</p>
  </section>`;
}

export const actions = {
  chClaim: el => {
    const c = monthChallenges().find(x => x.id === el.dataset.id);
    if (!c || c.value() < c.goal) return;
    update(s => {
      if (s.challenges.month !== monthKey()) s.challenges = { month: monthKey(), claimed: [] };
      if (!s.challenges.claimed.includes(c.id)) s.challenges.claimed.push(c.id);
    });
    reward(XP.challenge, 'challenge', `Desafío: ${c.text}`);
    if (claimedList().length === monthChallenges().length && !state.trophies.some(t => t.month === monthKey())) {
      update(s => { s.trophies.push({ month: monthKey(), theme: monthTheme() }); });
      celebrate(`🏆 ¡Trofeo del mes!\n${monthTheme()}`);
    }
  },
};
