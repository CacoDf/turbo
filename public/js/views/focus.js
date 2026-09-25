// Modo Foco: temporizador visual + mensajes de compañía + cierre sin culpa.
import { state } from '../store.js';
import { XP } from '../game.js';
import { nextStep } from '../planner.js';
import { esc, fmtClock, fmtDuration, pick } from '../util.js';
import { ring, setRing, beep, openSheet, closeSheet, toast } from '../ui.js';
import { findTask, toggleStep, completeTask, endFocus, extendFocus, reward, startFocus } from '../actions.js';
import { go, rerender } from '../router.js';

const COMPANION = [
  'Vas en tercera. Mantén las revoluciones 🏎️',
  'Sigo aquí contigo. Un pedacito más.',
  'No tiene que quedar perfecto, tiene que avanzar.',
  'Si te distrajiste, no pasa nada: vuelve al paso actual.',
  '¿El celu está lejos? Buena decisión.',
  'Respira. Hombros abajo. Sigue.',
  'Cada minuto aquí cuenta como entrenamiento para tu foco 💪',
  'Estás haciendo lo difícil: seguir.',
];

let ended = false;

export function render() {
  const f = state.focus;
  if (!f) {
    return `<header class="top"><h1>Foco</h1></header>
      <section class="card empty"><p>No hay sesión activa.</p>
      <div class="row"><button class="btn" data-act="focusFree" data-min="5">Solo 5 min</button><button class="btn ghost" data-act="focusFree" data-min="25">25 min</button></div>
      <p class="muted small">Sin tarea elegida: sirve para cualquier cosa.</p></section>`;
  }
  const t = findTask(f.taskId);
  const step = nextStep(t);
  const total = f.endAt - f.start;
  const pct = Math.min(1, (Date.now() - f.start) / total);
  return `<div class="focus-screen">
    <div class="muted center">${t ? esc(t.title) : f.label ? esc(f.label) : 'Sesión libre'}</div>
    <div class="center">${ring(1 - pct, { size: 270, inner: `<div class="clock" id="focusClock">${fmtClock(f.endAt - Date.now())}</div><div class="muted small">de ${fmtDuration(f.plannedMin)}</div>` })}</div>
    <div class="bubble" id="focusBubble">${pick(COMPANION)}</div>
    ${step ? `<button class="step" data-act="focusStep" data-task="${t.id}" data-step="${step.id}"><span class="check"></span><span><b>Ahora:</b> ${esc(step.text)}</span></button>` : ''}
    <div class="row">
      <button class="btn ghost" data-act="focusPlus" data-min="5">+5 min</button>
      <button class="btn ghost" data-act="focusStop">Terminar sesión</button>
    </div>
  </div>`;
}

function finishSheet() {
  const f = state.focus;
  const t = f && findTask(f.taskId);
  const early = f && f.endAt > Date.now();
  openSheet(`<h2>${early ? '⏸️ Cerrar sesión' : '🏁 ¡Tiempo!'}</h2>
    <p>${early ? 'Lo que alcanzaste a hacer cuenta. ¿Cómo sigue?' : 'Llegaste a la meta. ¿Cómo sigue?'}</p>
    ${t ? `<button class="btn" data-act="focusFinish" data-how="done">✓ Terminé la tarea</button>` : ''}
    <button class="btn secondary" data-act="focusFinish" data-how="more15">Sigo 15 min más 🔥</button>
    <button class="btn ghost" data-act="focusFinish" data-how="later">Lo dejo aquí por ahora</button>
    <p class="muted small">Dejarlo también está bien: ya avanzaste.</p>`);
}

export function mount() {
  const f = state.focus;
  if (!f) return;
  ended = false;
  let lock = null;
  navigator.wakeLock?.request('screen').then(l => (lock = l)).catch(() => {});
  let lastBubble = Date.now();
  const id = setInterval(() => {
    const cur = state.focus;
    if (!cur) return;
    const left = cur.endAt - Date.now();
    const clock = document.getElementById('focusClock');
    if (clock) clock.textContent = fmtClock(left);
    setRing(document.querySelector('.focus-screen .ring'), Math.max(0, left / (cur.endAt - cur.start)));
    // XP por cada 5 minutos reales de foco.
    const ticks = Math.floor((Math.min(Date.now(), cur.endAt) - cur.start) / 300000);
    if (ticks > cur.xpTicks) {
      cur.xpTicks = ticks;
      reward(XP.focusPer5, 'focus', '5 minutos de foco');
    }
    if (Date.now() - lastBubble > 150000) {
      lastBubble = Date.now();
      const b = document.getElementById('focusBubble');
      if (b) b.textContent = pick(COMPANION);
    }
    if (left <= 0 && !ended) {
      ended = true;
      beep();
      finishSheet();
    }
  }, 1000);
  return () => {
    clearInterval(id);
    lock?.release?.().catch(() => {});
  };
}

export const actions = {
  focusFree: el => startFocus(null, Number(el.dataset.min)),
  focusStep: el => {
    toggleStep(el.dataset.task, el.dataset.step);
    rerender();
  },
  focusPlus: el => {
    extendFocus(Number(el.dataset.min));
    ended = false;
    toast('+5 minutos');
    rerender();
  },
  focusStop: () => finishSheet(),
  focusFinish: el => {
    const how = el.dataset.how;
    const f = state.focus;
    closeSheet();
    if (how === 'more15') {
      extendFocus(15);
      ended = false;
      rerender();
      return;
    }
    const worked = endFocus();
    const t = f && findTask(f.taskId);
    if (how === 'done' && t) {
      completeTask(t.id);
      const real = Math.round((t.focusMs || 0) / 60000);
      if (real > 0) setTimeout(() => toast(`Estimaste ${fmtDuration(t.minutes)} · trabajaste ${fmtDuration(real)}`), 2400);
    } else {
      toast(`Trabajaste ${fmtDuration(worked / 60000)}. Bien ahí.`);
    }
    go('ahora');
  },
};
