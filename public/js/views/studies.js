// Estudios: ramos y evaluaciones. "Planificar" reparte sesiones de estudio hacia atrás
// desde la fecha de la prueba y las convierte en tareas del día.
import { state, update } from '../store.js';
import { XP } from '../game.js';
import { esc, uid, dayKey, addDays, parseDayKey, daysBetween, DAY_SHORT } from '../util.js';
import { toast, openSheet, closeSheet } from '../ui.js';
import { hasServer, aiStudyPlan, scheduleReminderSync } from '../api.js';
import { reward } from '../actions.js';
import { rerender } from '../router.js';

export const KINDS = { prueba: '📝 Prueba', control: '✏️ Control', examen: '🎯 Examen', entrega: '📦 Entrega', presentacion: '🎤 Presentación' };
const COLORS = ['#6fb3d9', '#7bd88f', '#f2b86b', '#a99cf2', '#ef8a8a', '#5cc8b0', '#e0a0d0'];
const SESSION_MIN = 45;

let showForm = false;

const course = id => state.courses.find(c => c.id === id);

function examTasks(examId) {
  return state.tasks.filter(t => t.examId === examId);
}

function countdown(date) {
  const d = daysBetween(dayKey(), date);
  if (d < 0) return 'ya pasó';
  if (d === 0) return '¡hoy!';
  if (d === 1) return 'mañana';
  return `en ${d} días`;
}

function examCard(e) {
  const c = course(e.courseId);
  const tasks = examTasks(e.id);
  const done = tasks.filter(t => t.done).length;
  const d = daysBetween(dayKey(), e.date);
  const date = parseDayKey(e.date);
  return `<section class="card exam ${e.done ? 'is-done' : ''}" style="border-left:4px solid ${c?.color || 'var(--line)'}">
    <div class="row between">
      <div><div class="muted small">${KINDS[e.kind] || e.kind} · ${esc(c?.name || 'Sin ramo')}</div><h2>${esc(e.title)}</h2></div>
      <div class="center"><div class="big-num ${d <= 2 && d >= 0 ? 'warn-text' : ''}">${d >= 0 ? d : '–'}</div><div class="muted tiny">${d === 1 ? 'día' : 'días'}</div></div>
    </div>
    <div class="muted small">${DAY_SHORT[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1} · ${countdown(e.date)}</div>
    ${tasks.length ? `<div class="bar"><div style="width:${(done / tasks.length) * 100}%;background:${c?.color || 'var(--accent)'}"></div></div>
      <div class="muted small">${done}/${tasks.length} sesiones de estudio hechas</div>`
      : e.done ? '' : `<button class="btn" data-act="stPlan" data-id="${e.id}">🗓️ Planificar sesiones de estudio</button>`}
    <div class="row">
      ${e.done ? '' : `<button class="btn ghost small" data-act="stDone" data-id="${e.id}">✓ Ya la di</button>`}
      <button class="btn ghost small danger" data-act="stDel" data-id="${e.id}">Borrar</button>
    </div>
  </section>`;
}

function form() {
  return `<section class="card">
    <h3>Nueva evaluación</h3>
    ${state.courses.length ? '' : '<p class="warn-text small">Primero agrega un ramo abajo.</p>'}
    <select class="input" id="exCourse">${state.courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <select class="input" id="exKind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <input class="input" id="exTitle" placeholder="ej: Prueba 2 (unidades 3 y 4)">
    <label class="muted small">Fecha <input class="input" type="date" id="exDate" min="${dayKey()}"></label>
    <label class="muted small">¿Cuántas horas de estudio crees que necesitas en total?
      <input class="input" type="number" id="exHours" min="1" max="30" value="4"></label>
    <button class="btn" data-act="stAdd">Agregar</button>
  </section>`;
}

export function render() {
  const upcoming = state.exams.filter(e => !e.done && e.date >= dayKey()).sort((a, b) => a.date.localeCompare(b.date));
  const old = state.exams.filter(e => e.done || e.date < dayKey()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<header class="top"><h1>📚 Estudios</h1><button class="btn small" data-act="stForm">${showForm ? 'Cerrar' : '+ Evaluación'}</button></header>
    <p class="muted">Anota tus pruebas y entregas. Turbo reparte el estudio en sesiones de ${SESSION_MIN} min antes de la fecha, así no queda todo para la noche anterior.</p>
    ${showForm ? form() : ''}
    ${upcoming.map(examCard).join('') || (showForm ? '' : '<section class="card empty"><p>Sin evaluaciones próximas.</p><button class="btn" data-act="stForm">+ Agregar prueba o entrega</button></section>')}
    <h3 class="group">Ramos</h3>
    <section class="card">
      ${state.courses.map(c => `<div class="row between win"><span><span class="swatch" style="background:${c.color}"></span>${esc(c.name)}</span><button class="icon-btn" data-act="stCourseDel" data-id="${c.id}" aria-label="Borrar ramo">✕</button></div>`).join('') || '<p class="muted small">Todavía no agregas ramos.</p>'}
      <div class="row"><input class="input grow" id="courseName" placeholder="ej: Finanzas"><button class="btn small" data-act="stCourseAdd">+</button></div>
    </section>
    ${old.length ? `<h3 class="group">Pasadas</h3>${old.map(examCard).join('')}` : ''}`;
}

// Días disponibles para estudiar: desde hoy (si aún es temprano) hasta el día anterior a la fecha.
function studyDays(date) {
  const days = [];
  const start = new Date().getHours() < 20 ? 0 : 1;
  for (let d = addDays(new Date(), start); dayKey(d) < date; d = addDays(d, 1)) days.push(dayKey(d));
  return days.length ? days : [dayKey()];
}

function fallbackTopics(kind, n) {
  if (n === 1) return [kind === 'entrega' ? 'Hacer y revisar la entrega' : 'Repasar lo más importante'];
  if (kind === 'entrega' || kind === 'presentacion') {
    return Array.from({ length: n }, (_, i) => i === 0 ? 'Leer instrucciones y armar un esquema' : i === n - 1 ? 'Revisar, pulir y dejar listo' : `Avanzar parte ${i}`);
  }
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return 'Ordenar la materia y hacer lista de temas';
    if (i === n - 1) return 'Repaso final y anotar dudas';
    if (i === n - 2 && n >= 4) return 'Ejercicios o preguntas de práctica';
    return `Estudiar y resumir la parte ${i}`;
  });
}

async function plan(examId) {
  const e = state.exams.find(x => x.id === examId);
  const c = course(e.courseId);
  const days = studyDays(e.date);
  const n = Math.max(1, Math.min(12, Math.ceil((e.hours * 60) / SESSION_MIN)));
  let topics = null;
  if (hasServer()) {
    toast('La IA está armando tu plan…');
    try {
      topics = await aiStudyPlan({ course: c?.name || '', kind: e.kind, title: e.title, sessions: n });
    } catch (err) {
      console.warn(err);
    }
  }
  if (!topics || topics.length !== n) topics = fallbackTopics(e.kind, n);
  update(s => {
    topics.forEach((topic, i) => {
      s.tasks.push({
        id: uid(), title: `${c?.name ? c.name + ' · ' : ''}${topic}`, area: 'estudios', minutes: SESSION_MIN,
        due: days[Math.floor((i * days.length) / n)], today: false, steps: [], done: false,
        createdAt: Date.now() + i, focusMs: 0, skips: 0, examId,
      });
    });
    s.exams.find(x => x.id === examId).planned = true;
  });
  reward(XP.studyPlan, 'study', `Planificaste: ${e.title}`);
  scheduleReminderSync();
  toast(`${n} sesiones repartidas en ${Math.min(n, days.length)} ${days.length === 1 ? 'día' : 'días'}. Las verás en Ahora y Tareas.`);
}

export const actions = {
  stForm: () => {
    showForm = !showForm;
    rerender();
  },
  stCourseAdd: () => {
    const name = document.getElementById('courseName').value.trim();
    if (!name) return toast('Escribe el nombre del ramo');
    update(s => { s.courses.push({ id: uid(), name, color: COLORS[s.courses.length % COLORS.length] }); });
  },
  stCourseDel: el => {
    if (!confirm('¿Borrar este ramo? Sus evaluaciones quedan sin ramo.')) return;
    update(s => { s.courses = s.courses.filter(c => c.id !== el.dataset.id); });
  },
  stAdd: () => {
    const courseId = document.getElementById('exCourse').value;
    const title = document.getElementById('exTitle').value.trim();
    const date = document.getElementById('exDate').value;
    const kind = document.getElementById('exKind').value;
    const hours = Math.max(1, Number(document.getElementById('exHours').value) || 4);
    if (!courseId) return toast('Primero agrega un ramo');
    if (!title || !date) return toast('Falta el nombre o la fecha');
    const id = uid();
    update(s => { s.exams.push({ id, courseId, kind, title, date, hours, planned: false, done: false }); });
    showForm = false;
    scheduleReminderSync();
    openSheet(`<h2>¿Planificamos el estudio?</h2>
      <p>Turbo reparte ~${Math.ceil((hours * 60) / SESSION_MIN)} sesiones de ${SESSION_MIN} min entre hoy y el día anterior a la fecha.</p>
      <button class="btn" data-act="stPlanSheet" data-id="${id}">Sí, planificar</button>
      <button class="btn ghost" data-act="closeSheet">Después</button>`);
  },
  stPlanSheet: el => {
    closeSheet();
    plan(el.dataset.id);
  },
  stPlan: el => plan(el.dataset.id),
  stDone: el => {
    update(s => { s.exams.find(x => x.id === el.dataset.id).done = true; });
    toast('¡Una menos! 🎉');
  },
  stDel: el => {
    const pending = examTasks(el.dataset.id).filter(t => !t.done).length;
    if (!confirm(`¿Borrar esta evaluación${pending ? ` y sus ${pending} sesiones pendientes` : ''}?`)) return;
    update(s => {
      s.exams = s.exams.filter(x => x.id !== el.dataset.id);
      s.tasks = s.tasks.filter(t => !(t.examId === el.dataset.id && !t.done));
    });
    scheduleReminderSync();
  },
};
