// Lista de tareas agrupada por urgencia + detalle para editar.
import { state, update } from '../store.js';
import { AREAS } from '../planner.js';
import { esc, dayKey, daysBetween, dueLabel, fmtDuration, uid } from '../util.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { findTask, completeTask, deleteTask, breakdown, toggleStep } from '../actions.js';
import { go, rerender } from '../router.js';

let showDone = false;
let openId = null;

function row(t) {
  const area = AREAS[t.area] || AREAS.personal;
  const steps = t.steps.length ? ` · ${t.steps.filter(s => s.done).length}/${t.steps.length} pasos` : '';
  return `<div class="task-row ${t.done ? 'done' : ''}">
    <button class="check ${t.done ? 'on' : ''}" data-act="taskToggle" data-id="${t.id}" aria-label="Terminar"></button>
    <button class="task-main" data-act="taskOpen" data-id="${t.id}">
      <div>${esc(t.title)}</div>
      <div class="muted small">${area.emoji} ${fmtDuration(t.minutes)}${t.due ? ` · ${dueLabel(t.due)}` : ''}${steps}</div>
    </button>
  </div>`;
}

function group(title, list, cls = '') {
  if (!list.length) return '';
  return `<h3 class="group ${cls}">${title} <span class="muted">${list.length}</span></h3>${list.map(row).join('')}`;
}

// Cuánto demoras en realidad vs. lo que estimas (entrena la percepción del tiempo).
function estimateInsight() {
  const measured = state.tasks.filter(t => t.done && t.focusMs > 60000 && t.minutes);
  if (measured.length < 3) return '';
  const ratio = measured.reduce((a, t) => a + t.focusMs / 60000, 0) / measured.reduce((a, t) => a + t.minutes, 0);
  const msg = ratio > 1.15 ? `sueles demorar <b>${ratio.toFixed(1)}×</b> lo que estimas. Agrégale un colchón.` : ratio < 0.85 ? `terminas más rápido de lo que crees (<b>${ratio.toFixed(1)}×</b>).` : 'tus estimaciones son bien precisas 👌';
  return `<section class="card compact">⏳ Según ${measured.length} tareas medidas, ${msg}</section>`;
}

export function render() {
  const open = state.tasks.filter(t => !t.done);
  const today = dayKey();
  const late = open.filter(t => t.due && t.due < today);
  const now = open.filter(t => !late.includes(t) && (t.due === today || t.today));
  const soon = open.filter(t => !late.includes(t) && !now.includes(t) && t.due && daysBetween(today, t.due) <= 7);
  const later = open.filter(t => !late.includes(t) && !now.includes(t) && !soon.includes(t));
  const done = state.tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 30);
  return `<header class="top"><h1>Tareas</h1><button class="btn small" data-act="go" data-to="capturar">+ Agregar</button></header>
    ${open.length ? '' : '<section class="card empty"><p>No tienes tareas pendientes.</p></section>'}
    ${group('Atrasadas', late.sort((a, b) => a.due.localeCompare(b.due)), 'bad')}
    ${group('Hoy', now)}
    ${group('Próximos 7 días', soon.sort((a, b) => a.due.localeCompare(b.due)))}
    ${group('Más adelante / sin fecha', later)}
    ${estimateInsight()}
    ${done.length ? `<button class="link" data-act="taskShowDone">${showDone ? 'Ocultar' : 'Ver'} terminadas (${done.length})</button>${showDone ? done.map(row).join('') : ''}` : ''}`;
}

function detail(t) {
  return `<h2>Editar tarea</h2>
    <input class="input" value="${esc(t.title)}" data-change="taskField" data-f="title">
    <div class="row wrap">
      <select class="input" data-change="taskField" data-f="area">
        ${Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === t.area ? 'selected' : ''}>${a.emoji} ${a.label}</option>`).join('')}
      </select>
      <input class="input" type="number" min="5" step="5" value="${t.minutes}" data-change="taskField" data-f="minutes" aria-label="Minutos">
      <input class="input" type="date" value="${t.due || ''}" data-change="taskField" data-f="due">
    </div>
    <label class="toggle"><input type="checkbox" ${t.today ? 'checked' : ''} data-change="taskField" data-f="today"> Quiero hacerla hoy</label>
    <h3>Pasos</h3>
    ${t.steps.map(s => `<div class="row step-edit">
        <button class="check ${s.done ? 'on' : ''}" data-act="taskStep" data-step="${s.id}" aria-label="Paso hecho"></button>
        <span class="grow ${s.done ? 'muted strike' : ''}">${esc(s.text)}</span>
        <button class="icon-btn" data-act="taskStepDel" data-step="${s.id}" aria-label="Borrar paso">✕</button>
      </div>`).join('') || '<p class="muted small">Sin pasos todavía.</p>'}
    <div class="row">
      <input class="input grow" id="newStep" placeholder="Agregar un paso…">
      <button class="btn small" data-act="taskStepAdd">+</button>
    </div>
    <button class="btn ghost small" data-act="taskBreak">🪄 ${t.steps.length ? 'Rehacer' : 'Crear'} pasos automáticamente</button>
    <button class="btn" data-act="taskNow">▶ Hacer esta ahora</button>
    <div class="row">
      <button class="btn ghost" data-act="closeSheet">Listo</button>
      <button class="btn danger ghost" data-act="taskDelete">Borrar</button>
    </div>`;
}

function refreshSheet() {
  const t = findTask(openId);
  if (t) openSheet(detail(t));
  else closeSheet();
}

export const actions = {
  taskToggle: el => {
    const t = findTask(el.dataset.id);
    if (!t) return;
    if (t.done) update(s => { const x = s.tasks.find(y => y.id === t.id); x.done = false; x.doneAt = null; });
    else completeTask(t.id);
  },
  taskOpen: el => {
    openId = el.dataset.id;
    refreshSheet();
  },
  taskShowDone: () => {
    showDone = !showDone;
    rerender();
  },
  taskField: el => {
    const f = el.dataset.f;
    const v = f === 'today' ? el.checked : f === 'minutes' ? Math.max(5, Number(el.value) || 25) : f === 'due' ? el.value || null : el.value;
    update(s => { const x = s.tasks.find(y => y.id === openId); if (x) x[f] = v; });
  },
  taskStep: el => {
    toggleStep(openId, el.dataset.step);
    refreshSheet();
  },
  taskStepDel: el => {
    update(s => { const x = s.tasks.find(y => y.id === openId); x.steps = x.steps.filter(st => st.id !== el.dataset.step); });
    refreshSheet();
  },
  taskStepAdd: () => {
    const input = document.getElementById('newStep');
    const text = input?.value.trim();
    if (!text) return;
    update(s => { s.tasks.find(y => y.id === openId).steps.push({ id: uid(), text, min: 0, done: false }); });
    refreshSheet();
    document.getElementById('newStep')?.focus();
  },
  taskBreak: async () => {
    await breakdown(openId);
    refreshSheet();
  },
  taskNow: () => {
    update(s => { s.currentTaskId = openId; });
    closeSheet();
    go('ahora');
  },
  taskDelete: () => {
    if (!confirm('¿Borrar esta tarea?')) return;
    deleteTask(openId);
    closeSheet();
    toast('Tarea borrada');
  },
};
