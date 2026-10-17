// Modo Foco: temporizador visual + mensajes de compañía + cierre sin culpa.
import { state, update } from '../store.js';
import { XP } from '../game.js';
import { nextStep } from '../planner.js';
import { esc, fmtClock, fmtDuration, pick } from '../util.js';
import { ring, setRing, alarma, openSheet, closeSheet, toast } from '../ui.js';
import { findTask, toggleStep, completeTask, endFocus, extendFocus, reward, startFocus, focoMin, descansoMin } from '../actions.js';
import { go, rerender } from '../router.js';

const DESCANSO = [
  'Levántate, toma agua y mira lejos.',
  'Si puedes, sin pantalla: estira la espalda.',
  'Descansar también es parte del foco.',
];

// Rueda de minutos (en el iPhone abre el selector nativo, como el temporizador).
export const rueda = (campo, desde, hasta, valor) => `<select class="input" data-change="focusSet" data-f="${campo}" aria-label="${campo === 'focoMin' ? 'Minutos de foco' : 'Minutos de descanso'}">
  ${Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map(n => `<option value="${n}"${n === valor ? ' selected' : ''}>${n} min</option>`).join('')}</select>`;

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

// Qué sesión ya avisó que terminó (inicio-fin): así redibujar la pantalla no repite la alarma ni la hoja.
let avisado = null;

export function render() {
  const f = state.focus;
  if (!f) {
    const foco = focoMin();
    const descanso = descansoMin();
    return `<header class="top"><h1>Foco</h1></header>
      <section class="card">
      <div class="row">
        <label class="grow muted small">Foco ▾ ${rueda('focoMin', 5, 180, foco)}</label>
        <label class="grow muted small">Descanso ▾ ${rueda('descansoMin', 1, 60, descanso)}</label>
      </div>
      <button class="btn huge" data-act="focusFree" data-min="${foco}">▶ Partir ${foco} min</button>
      <button class="btn ghost" data-act="focusFree" data-min="5">Solo 5 min</button>
      ${foco === 25 && descanso === 5 ? '<p class="muted small">✓ Clásico 25 / 5</p>' : '<button class="link" data-act="focusClasico">Volver al clásico 25 / 5</button>'}
      <p class="muted small">Sin tarea elegida: sirve para cualquier cosa. Los minutos quedan guardados para la próxima.</p></section>`;
  }
  const t = findTask(f.taskId);
  const step = nextStep(t);
  const total = f.endAt - f.start;
  const pct = Math.min(1, (Date.now() - f.start) / total);
  return `<div class="focus-screen">
    <div class="muted center">${f.descanso ? '☕ Descanso' : t ? esc(t.title) : f.label ? esc(f.label) : 'Sesión libre'}</div>
    <div class="center">${ring(1 - pct, { size: 270, inner: `<div class="clock" id="focusClock">${fmtClock(f.endAt - Date.now())}</div><div class="muted small">de ${fmtDuration(f.plannedMin)}</div>` })}</div>
    <div class="bubble" id="focusBubble">${f.minimo ? 'Solo esto. Cuando suene, listo.' : pick(f.descanso ? DESCANSO : COMPANION)}</div>
    ${step && !f.descanso ? `<button class="step" data-act="focusStep" data-task="${t.id}" data-step="${step.id}"><span class="check"></span><span><b>Ahora:</b> ${esc(step.text)}</span></button>` : ''}
    <div class="row">
      ${f.minimo || f.descanso ? '' : '<button class="btn ghost" data-act="focusPlus" data-min="5">+5 min</button>'}
      <button class="btn ghost" data-act="focusStop">${f.descanso ? 'Terminar descanso' : 'Terminar sesión'}</button>
    </div>
  </div>`;
}

function finishSheet() {
  const f = state.focus;
  const t = f && findTask(f.taskId);
  const early = f && f.endAt > Date.now();
  // Día mínimo: no se pide nada más. Seguir es opcional y chico.
  if (f?.minimo) {
    return openSheet(`<h2>💚 Listo</h2>
      <p>Eso era todo por hoy.</p>
      <button class="btn" data-act="focusFinish" data-how="later">Listo</button>
      <button class="btn ghost" data-act="focusFinish" data-how="more5">Seguir 5 min</button>`);
  }
  if (f?.descanso) {
    return openSheet(`<h2>☕ ${early ? 'Cortar el descanso' : 'Fin del descanso'}</h2>
      <p>¿Otra vuelta?</p>
      <button class="btn" data-act="focusFinish" data-how="vuelta">▶ Otra vuelta de ${focoMin()} min</button>
      <button class="btn ghost" data-act="focusFinish" data-how="later">Lo dejo aquí por ahora</button>`);
  }
  openSheet(`<h2>${early ? '⏸️ Cerrar sesión' : '🏁 ¡Tiempo!'}</h2>
    <p>${early ? 'Lo que alcanzaste a hacer cuenta. ¿Cómo sigue?' : 'Llegaste a la meta. ¿Cómo sigue?'}</p>
    ${early ? '' : `<button class="btn" data-act="focusFinish" data-how="descanso">☕ Descanso ${descansoMin()} min</button>`}
    ${t ? `<button class="btn ${early ? '' : 'secondary'}" data-act="focusFinish" data-how="done">✓ Terminé la tarea</button>` : ''}
    <button class="btn ghost" data-act="focusFinish" data-how="later">Lo dejo aquí por ahora</button>
    <button class="link" data-act="focusFinish" data-how="more15">Sigo 15 min más 🔥</button>
    <p class="muted small">Dejarlo también está bien: ya avanzaste.</p>`);
}

export function mount() {
  const f = state.focus;
  if (!f) return;
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
    if (ticks > cur.xpTicks && !cur.descanso) {
      cur.xpTicks = ticks;
      reward(XP.focusPer5, 'focus', '5 minutos de foco');
    }
    if (Date.now() - lastBubble > 150000) {
      lastBubble = Date.now();
      const b = document.getElementById('focusBubble');
      if (b && !cur.minimo) b.textContent = pick(cur.descanso ? DESCANSO : COMPANION);
    }
    const clave = `${cur.start}-${cur.endAt}`; // si alarga la sesión, cambia el fin y puede volver a avisar
    if (left <= 0 && avisado !== clave) {
      avisado = clave;
      // Suena solo si terminó recién, con Foco a la vista. Si llegó desde la notificación (ya sonó) o volvió
      // a la app después, solo se muestra la hoja.
      if (-left < 4000 && document.visibilityState === 'visible') alarma(cur.descanso ? 'descanso' : 'foco');
      finishSheet();
    }
  }, 1000);
  return () => {
    clearInterval(id); // la alarma no se apaga aquí: un redibujo la cortaría; la apaga cualquier toque
    lock?.release?.().catch(() => {});
  };
}

export const actions = {
  focusFree: el => startFocus(null, Number(el.dataset.min)),
  focusSet: el => update(s => { s.settings[el.dataset.f] = Number(el.value); }),
  focusClasico: () => update(s => { s.settings.focoMin = 25; s.settings.descansoMin = 5; }),
  focusStep: el => {
    toggleStep(el.dataset.task, el.dataset.step);
    rerender();
  },
  focusPlus: el => {
    extendFocus(Number(el.dataset.min));
    toast('+5 minutos');
    rerender();
  },
  focusStop: () => finishSheet(),
  focusFinish: el => {
    const how = el.dataset.how;
    const f = state.focus;
    closeSheet();
    if (how === 'more15' || how === 'more5') {
      extendFocus(how === 'more5' ? 5 : 15);
      rerender();
      return;
    }
    if (how === 'descanso') {
      const worked = endFocus();
      startFocus(null, descansoMin(), null, { descanso: true, volverA: f?.taskId || null, volverLabel: f?.label || null });
      toast(`Trabajaste ${fmtDuration(worked / 60000)}. Ahora descansa.`);
      return;
    }
    if (how === 'vuelta') {
      endFocus();
      const t = f?.volverA && findTask(f.volverA);
      startFocus(t && !t.done ? t.id : null, focoMin(), f?.volverLabel || null);
      return;
    }
    const worked = endFocus();
    if (f?.descanso) {
      toast('Descansaste. Bien ahí.');
      return go('ahora');
    }
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
