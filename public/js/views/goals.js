// Metas: objetivos grandes que la IA convierte en 2 a 4 tareas chicas cada semana.
import { state, update } from '../store.js';
import { esc, uid, dayKey, addDays, parseDayKey, daysBetween } from '../util.js';
import { bar, toast, celebrate } from '../ui.js';
import { hasServer, aiGoalWeek, scheduleReminderSync } from '../api.js';
import { reward } from '../actions.js';
import { rerender } from '../router.js';

const EXAMPLES = ['Conseguir pega', 'Subir 10 kg en press banca', 'Aprender inglés', 'Ahorrar $200.000', 'Leer un libro al mes', 'Ordenar mi pieza de una vez'];

let showForm = false;

// Lunes de la semana de una fecha (clave YYYY-MM-DD).
export function mondayKey(d = new Date()) {
  return dayKey(addDays(d, -((d.getDay() + 6) % 7)));
}

const goalTasks = id => state.tasks.filter(t => t.goalId === id);

export function addGoal({ title, why = '', deadline = null }) {
  const id = uid();
  update(s => { s.goals.push({ id, title, why, deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline || '') ? deadline : null, createdAt: Date.now(), weekPlanned: null, done: false }); });
  return id;
}

// Fecha de esta semana para el día sugerido; si ya pasó, el próximo día libre desde hoy.
function dateForDay(dow, used) {
  const monday = parseDayKey(mondayKey());
  let d = addDays(monday, (dow + 6) % 7);
  if (dayKey(d) < dayKey()) d = new Date();
  while (used.filter(x => x === dayKey(d)).length >= 1 && dayKey(d) < dayKey(addDays(monday, 6))) d = addDays(d, 1);
  used.push(dayKey(d));
  return dayKey(d);
}

export async function planGoalWeek(id, { quiet = false } = {}) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  const tasks = goalTasks(id);
  let plan = null;
  if (hasServer()) {
    if (!quiet) toast('Armando los pasos de la semana…');
    try {
      plan = await aiGoalWeek({
        goal: { title: g.title, why: g.why, deadline: g.deadline },
        done: tasks.filter(t => t.done).map(t => t.title),
        pending: tasks.filter(t => !t.done).map(t => t.title),
        today: new Date().toDateString(),
      });
    } catch (e) {
      console.warn(e);
    }
  }
  if (!plan?.length) plan = [1, 3, 5].map(day => ({ title: `Avanzar en: ${g.title}`, minutes: 30, day }));
  const used = [];
  update(s => {
    plan.forEach((p, i) => s.tasks.push({
      id: uid(), title: p.title, area: 'personal', minutes: p.minutes, due: dateForDay(p.day, used), today: false,
      steps: [], done: false, createdAt: Date.now() + i, focusMs: 0, skips: 0, goalId: id,
    }));
    s.goals.find(x => x.id === id).weekPlanned = mondayKey();
  });
  scheduleReminderSync();
  if (!quiet) toast(`${plan.length} pasos agregados para esta semana 🎯`);
  return plan.length;
}

function goalCard(g) {
  const tasks = goalTasks(g.id);
  const done = tasks.filter(t => t.done).length;
  const weekTasks = tasks.filter(t => t.due && t.due >= mondayKey());
  const weekDone = weekTasks.filter(t => t.done).length;
  const left = g.deadline ? daysBetween(dayKey(), g.deadline) : null;
  return `<section class="card ${g.done ? 'is-done' : ''}">
    <div class="row between"><h2>🎯 ${esc(g.title)}</h2>${g.done ? '<span class="ok">🏆</span>' : ''}</div>
    ${g.why ? `<p class="muted small">Por qué: ${esc(g.why)}</p>` : ''}
    <div class="muted small">${done} pasos hechos en total${left != null ? ` · ${left >= 0 ? `quedan ${left} días` : 'fecha pasada'}` : ''}</div>
    ${weekTasks.length ? `${bar(weekDone / weekTasks.length, 'var(--fuel)')}<div class="muted small">Esta semana: ${weekDone}/${weekTasks.length}</div>` : ''}
    ${g.done ? '' : `<div class="row">
      ${g.weekPlanned === mondayKey() ? '<button class="btn ghost" data-act="glPlan" data-id="' + g.id + '">+ Más pasos</button>' : `<button class="btn" data-act="glPlan" data-id="${g.id}">🗓️ Planificar esta semana</button>`}
      <button class="btn ghost small" data-act="glDone" data-id="${g.id}">🏆 Lograda</button>
      <button class="icon-btn" data-act="glDel" data-id="${g.id}" aria-label="Borrar">✕</button>
    </div>`}
  </section>`;
}

export function render() {
  const active = state.goals.filter(g => !g.done);
  const done = state.goals.filter(g => g.done);
  return `<header class="top"><h1>🎯 Metas</h1><button class="btn small" data-act="glForm">${showForm ? 'Cerrar' : '+ Meta'}</button></header>
    <p class="muted">Cosas grandes que quieres lograr. Cada semana Turbo las divide en 2 a 4 pasos chicos que aparecen en Ahora.</p>
    ${showForm || !state.goals.length ? `<section class="card">
      <input class="input" id="glTitle" placeholder="¿Qué quieres lograr?">
      <div class="chips pick">${EXAMPLES.map(e => `<button class="chip" data-act="glExample" data-t="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <input class="input" id="glWhy" placeholder="¿Por qué te importa? (opcional, ayuda a la IA)">
      <label class="muted small">Fecha límite (opcional) <input class="input" type="date" id="glDeadline" min="${dayKey()}"></label>
      <button class="btn" data-act="glAdd">Crear meta y planificar la semana</button>
    </section>` : ''}
    ${active.map(goalCard).join('')}
    ${done.length ? `<h3 class="group">Logradas 🏆</h3>${done.map(goalCard).join('')}` : ''}`;
}

export const actions = {
  glForm: () => {
    showForm = !showForm;
    rerender();
  },
  glExample: el => {
    document.getElementById('glTitle').value = el.dataset.t;
  },
  glAdd: async () => {
    const title = document.getElementById('glTitle').value.trim();
    if (!title) return toast('Escribe tu meta');
    const id = addGoal({ title, why: document.getElementById('glWhy').value.trim(), deadline: document.getElementById('glDeadline').value });
    showForm = false;
    await planGoalWeek(id);
  },
  glPlan: el => planGoalWeek(el.dataset.id),
  glDone: el => {
    const g = state.goals.find(x => x.id === el.dataset.id);
    if (!confirm(`¿Lograste "${g.title}"? 🏆`)) return;
    update(s => {
      s.goals.find(x => x.id === g.id).done = true;
      s.tasks = s.tasks.filter(t => !(t.goalId === g.id && !t.done));
    });
    reward(100, 'goal', `Meta lograda: ${g.title}`);
    celebrate(`🏆 ¡Meta lograda!\n${g.title}`);
  },
  glDel: el => {
    const g = state.goals.find(x => x.id === el.dataset.id);
    if (!confirm(`¿Borrar la meta "${g.title}" y sus pasos pendientes?`)) return;
    update(s => {
      s.goals = s.goals.filter(x => x.id !== g.id);
      s.tasks = s.tasks.filter(t => !(t.goalId === g.id && !t.done));
    });
  },
};
