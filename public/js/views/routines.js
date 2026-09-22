// Rutinas: secuencias fijas (mañana, noche, antes del gym) guiadas paso a paso con temporizador.
import { state, update } from '../store.js';
import { XP } from '../game.js';
import { esc, dayKey, fmtClock, fmtDuration, minToHm, uid, DAY_SHORT } from '../util.js';
import { bar, toast, celebrate, beep, unlockAudio } from '../ui.js';
import { reward } from '../actions.js';
import { scheduleReminderSync } from '../api.js';
import { rerender } from '../router.js';

let run = null; // { id, i, stepStart }
let editId = null;

function daysText(days) {
  const k = [...days].sort().join('');
  if (k === '0123456') return 'todos los días';
  if (k === '12345') return 'Lun a Vie';
  if (k === '06') return 'fines de semana';
  return [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => DAY_SHORT[d]).join(', ');
}

const total = r =>r.steps.reduce((a, s) => a + (Number(s.min) || 0), 0);
const doneToday = r => !!state.routineLog[dayKey()]?.[r.id];

// La rutina que toca ahora: la que tiene hora hoy entre 30 min antes y 90 min después.
export function routineNow() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return state.routines.find(r => {
    if (!r.at || !r.days?.includes(now.getDay()) || doneToday(r)) return false;
    const [h, m] = r.at.split(':').map(Number);
    const d = mins - (h * 60 + m);
    return d >= -30 && d <= 90;
  }) || null;
}

function list() {
  return `<header class="top"><h1>🔄 Rutinas</h1><button class="btn small" data-act="rtNew">+ Nueva</button></header>
    <p class="muted">Una secuencia fija, un paso a la vez. Sin pensar qué sigue.</p>
    ${state.routines.map(r => `<section class="card ${doneToday(r) ? 'is-done' : ''}">
      <div class="row between">
        <div><h2>${r.emoji} ${esc(r.name)}</h2>
          <div class="muted small">${r.steps.length} pasos · ${fmtDuration(total(r))}${r.at && r.days.length ? ` · ${daysText(r.days)} a las ${r.at}` : ''}</div></div>
        ${doneToday(r) ? '<span class="ok">✓ Hoy</span>' : ''}
      </div>
      <div class="row">
        <button class="btn" data-act="rtStart" data-id="${r.id}">▶ Empezar</button>
        <button class="btn ghost" data-act="rtEdit" data-id="${r.id}">Editar</button>
      </div>
    </section>`).join('')}`;
}

function runner() {
  const r = state.routines.find(x => x.id === run.id);
  const s = r.steps[run.i];
  const left = r.steps.slice(run.i).reduce((a, x) => a + (Number(x.min) || 0), 0);
  const endAt = new Date(Date.now() + left * 60000);
  return `<div class="focus-screen">
    <div class="row between"><b>${r.emoji} ${esc(r.name)}</b><span class="muted small">Paso ${run.i + 1} de ${r.steps.length}</span></div>
    ${bar(run.i / r.steps.length)}
    <section class="card hero center">
      <h2 class="task-title">${esc(s.text)}</h2>
      ${s.min ? `<div class="clock" id="rtClock">${fmtClock(s.min * 60000)}</div>` : ''}
      <div class="muted small">Terminas cerca de las ${minToHm(endAt.getHours() * 60 + endAt.getMinutes())}</div>
    </section>
    <button class="btn huge" data-act="rtNext">✓ Listo</button>
    <div class="row">
      <button class="btn ghost" data-act="rtSkip">Saltar</button>
      <button class="btn ghost" data-act="rtStop">Salir</button>
    </div>
    ${r.steps[run.i + 1] ? `<p class="muted small center">Después: ${esc(r.steps[run.i + 1].text)}</p>` : ''}
  </div>`;
}

function editor() {
  const r = state.routines.find(x => x.id === editId);
  return `<header class="top"><h1>Editar rutina</h1></header>
    <section class="card">
      <div class="row"><input class="input emoji-in" value="${esc(r.emoji)}" data-change="rtField" data-f="emoji" maxlength="4" aria-label="Emoji">
        <input class="input grow" value="${esc(r.name)}" data-change="rtField" data-f="name" aria-label="Nombre"></div>
      <label class="muted small">Avisarme a las (déjalo vacío si no quieres aviso)
        <input class="input" type="time" value="${r.at || ''}" data-change="rtField" data-f="at"></label>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" ${r.days.includes(d) ? 'checked' : ''} data-change="rtDay" data-d="${d}"><span>${DAY_SHORT[d]}</span></label>`).join('')}</div>
    </section>
    <h3 class="group">Pasos</h3>
    ${r.steps.map((s, i) => `<div class="card compact row">
      <div class="grow"><input class="input" value="${esc(s.text)}" data-change="rtStep" data-i="${i}" data-f="text"></div>
      <input class="input" style="width:70px" type="number" min="0" value="${s.min}" data-change="rtStep" data-i="${i}" data-f="min" aria-label="Minutos">
      <button class="icon-btn" data-act="rtStepUp" data-i="${i}" aria-label="Subir">↑</button>
      <button class="icon-btn" data-act="rtStepDel" data-i="${i}" aria-label="Borrar">✕</button>
    </div>`).join('')}
    <div class="row"><input class="input grow" id="rtNewStep" placeholder="Nuevo paso…"><input class="input" style="width:70px" id="rtNewMin" type="number" min="0" value="5" aria-label="Minutos"><button class="btn small" data-act="rtStepAdd">+</button></div>
    <button class="btn" data-act="rtDone">Listo</button>
    <button class="btn danger ghost" data-act="rtDelete">Borrar rutina</button>`;
}

export function render() {
  if (run) return runner();
  if (editId && state.routines.some(r => r.id === editId)) return editor();
  return list();
}

export function mount() {
  if (!run) return;
  const r = state.routines.find(x => x.id === run.id);
  const s = r?.steps[run.i];
  if (!s?.min) return;
  let beeped = false;
  const started = run.stepStart;
  const id = setInterval(() => {
    const el = document.getElementById('rtClock');
    if (!el || !run) return clearInterval(id);
    const left = s.min * 60000 - (Date.now() - started);
    el.textContent = left > 0 ? fmtClock(left) : '+' + fmtClock(-left);
    el.classList.toggle('over', left <= 0);
    if (left <= 0 && !beeped) {
      beeped = true;
      beep();
    }
  }, 1000);
  return () => clearInterval(id);
}

function advance() {
  const r = state.routines.find(x => x.id === run.id);
  if (run.i + 1 < r.steps.length) {
    run = { ...run, i: run.i + 1, stepStart: Date.now() };
    rerender();
    return;
  }
  run = null;
  update(s => {
    s.routineLog[dayKey()] = s.routineLog[dayKey()] || {};
    s.routineLog[dayKey()][r.id] = true;
  });
  reward(XP.routine, 'routine', `Rutina ${r.emoji} ${r.name}`);
  celebrate(`${r.emoji} ¡Rutina completa!`);
  scheduleReminderSync();
}

const cur = () => state.routines.find(x => x.id === editId);

export function startRoutine(id) {
  const r = state.routines.find(x => x.id === id);
  if (!r?.steps.length) return toast('Esta rutina no tiene pasos todavía');
  unlockAudio();
  run = { id, i: 0, stepStart: Date.now() };
  rerender();
}

export const actions = {
  rtStart: el => startRoutine(el.dataset.id),
  rtNext: advance,
  rtSkip: advance,
  rtStop: () => {
    run = null;
    rerender();
  },
  rtNew: () => {
    const id = uid();
    update(s => { s.routines.push({ id, name: 'Nueva rutina', emoji: '⭐', at: null, days: [], steps: [] }); });
    editId = id;
    rerender();
  },
  rtEdit: el => {
    editId = el.dataset.id;
    rerender();
  },
  rtDone: () => {
    editId = null;
    update(() => {}); // guarda y respalda lo editado en silencio
    scheduleReminderSync();
  },
  rtField: el => {
    const f = el.dataset.f;
    update(s => { s.routines.find(x => x.id === editId)[f] = f === 'at' ? el.value || null : el.value; }, { silent: true });
  },
  rtDay: el => {
    const d = Number(el.dataset.d);
    update(s => {
      const r = s.routines.find(x => x.id === editId);
      r.days = el.checked ? [...new Set([...r.days, d])] : r.days.filter(x => x !== d);
    }, { silent: true });
  },
  rtStep: el => {
    const i = Number(el.dataset.i);
    update(s => {
      const st = s.routines.find(x => x.id === editId).steps[i];
      st[el.dataset.f] = el.dataset.f === 'min' ? Math.max(0, Number(el.value) || 0) : el.value;
    }, { silent: true });
  },
  rtStepUp: el => {
    const i = Number(el.dataset.i);
    if (i === 0) return;
    update(s => {
      const st = s.routines.find(x => x.id === editId).steps;
      [st[i - 1], st[i]] = [st[i], st[i - 1]];
    });
  },
  rtStepDel: el => update(s => { s.routines.find(x => x.id === editId).steps.splice(Number(el.dataset.i), 1); }),
  rtStepAdd: () => {
    const text = document.getElementById('rtNewStep').value.trim();
    if (!text) return toast('Escribe el paso');
    const min = Math.max(0, Number(document.getElementById('rtNewMin').value) || 0);
    update(s => { s.routines.find(x => x.id === editId).steps.push({ id: uid(), text, min }); });
  },
  rtDelete: () => {
    if (!confirm(`¿Borrar la rutina "${cur().name}"?`)) return;
    update(s => { s.routines = s.routines.filter(x => x.id !== editId); });
    editId = null;
    scheduleReminderSync();
  },
};
