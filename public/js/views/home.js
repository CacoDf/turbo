// Pantalla "Ahora": una sola tarea, un solo paso, un botón para arrancar.
import { state, update } from '../store.js';
import { suggestTask, nextStep, nowAndNext, AREAS, KINDS } from '../planner.js';
import { levelInfo, todayWins, habitsDoneToday } from '../game.js';
import { esc, fmtDateLong, fmtDuration, fmtClock, dueLabel, DAY_SHORT } from '../util.js';
import { bar, carSvg } from '../ui.js';
import { startFocus, breakdown, toggleStep, completeTask } from '../actions.js';
import { rerender, go } from '../router.js';
import { routineNow, startRoutine } from './routines.js';
import { needsCheckin, checkinCard } from './mood.js';
import { unseenCheer } from './partner.js';

let skipIds = [];

// Como mucho UNA tarjeta extra, para no llenar la pantalla: ánimo recibido > rutina > check-in.
function extraCard() {
  const cheer = unseenCheer();
  if (cheer) {
    return `<section class="card cheer">
      <div class="label">💌 TE MANDARON ÁNIMO</div>
      <p><b>${esc(cheer.from || 'Alguien')}:</b> ${esc(cheer.msg)}</p>
      <button class="btn ghost small" data-act="homeCheerSeen">❤️ Gracias</button>
    </section>`;
  }
  const r = routineNow();
  if (r) {
    return `<section class="card compact row between">
      <span>${r.emoji} Es hora de tu rutina de <b>${esc(r.name)}</b></span>
      <button class="btn small" data-act="homeRoutine" data-id="${r.id}">▶ Empezar</button>
    </section>`;
  }
  if (needsCheckin()) return checkinCard();
  return '';
}

function eventPill() {
  const { current, next } = nowAndNext();
  const now = Date.now();
  if (current) {
    return `<div class="pill">${KINDS[current.kind]?.emoji || '📌'} En ${esc(current.title)} · termina en ${fmtDuration((current.endAt - now) / 60000)}</div>`;
  }
  if (next) {
    const min = (next.startAt - now) / 60000;
    const when = min < 24 * 60 ? `en ${fmtDuration(min)}` : `el ${DAY_SHORT[next.startAt.getDay()]} a las ${next.start}`;
    return `<div class="pill ${min < 30 ? 'warn' : ''}">${KINDS[next.kind]?.emoji || '📌'} ${esc(next.title)} ${when}</div>`;
  }
  return `<div class="pill">Día libre de horarios fijos</div>`;
}

function onboarding() {
  if (state.meta.onboarded) return '';
  return `<section class="card intro">
    <h2>Bienvenido a Turbo 🏎️</h2>
    <ol>
      <li><b>Vacía la cabeza:</b> anota todo lo pendiente, en desorden.</li>
      <li><b>Turbo elige una sola cosa</b> y la divide en pasos chicos.</li>
      <li><b>Toca "Solo 5 minutos".</b> Solo tienes que arrancar.</li>
    </ol>
    <p class="muted">Cada cosa que haces te da XP y bencina ⛽ para canjear premios. Subes de nivel y desbloqueas autos.</p>
    <button class="btn" data-act="homeOnboarded">Vamos</button>
  </section>`;
}

function focusCard() {
  const f = state.focus;
  if (!f) return '';
  const left = f.endAt - Date.now();
  return `<section class="card focus-live" data-act="go" data-to="foco">
    <div>⏱️ Sesión en curso</div>
    <div class="big-num" id="homeFocusLeft">${left > 0 ? fmtClock(left) : '¡Tiempo!'}</div>
    <div class="muted">Toca para volver</div>
  </section>`;
}

function taskCard() {
  const t = suggestTask(skipIds);
  if (!t) {
    return `<section class="card now">
      <div class="label">AHORA</div>
      <h2 class="task-title">No tienes tareas anotadas</h2>
      <p class="muted">Anota lo que tengas pendiente y Turbo elige por dónde partir. O usa 5 minutos para cualquier cosa.</p>
      <button class="btn huge" data-act="go" data-to="capturar">🧠 Vaciar la cabeza</button>
      <button class="btn ghost" data-act="homeFree">▶ Solo 5 minutos (sin tarea)</button>
    </section>`;
  }
  const step = nextStep(t);
  const doneSteps = t.steps.filter(s => s.done).length;
  const area = AREAS[t.area] || AREAS.personal;
  return `<section class="card now">
    <div class="label">AHORA</div>
    <h2 class="task-title">${esc(t.title)}</h2>
    <div class="chips">
      <span class="chip">${area.emoji} ${area.label}</span>
      <span class="chip">~${fmtDuration(t.minutes)}</span>
      ${t.due ? `<span class="chip ${dueLabel(t.due).startsWith('Atras') ? 'bad' : ''}">${dueLabel(t.due)}</span>` : ''}
    </div>
    ${step ? `<button class="step" data-act="homeStep" data-task="${t.id}" data-step="${step.id}">
        <span class="check"></span><span><b>Paso ${doneSteps + 1} de ${t.steps.length}:</b> ${esc(step.text)}${step.min ? ` <span class="muted">(${step.min} min)</span>` : ''}</span>
      </button>` : t.steps.length ? `<p class="ok">✅ Todos los pasos listos. ¿La marcas como terminada?</p>`
      : `<button class="btn ghost small" data-act="homeBreak" data-id="${t.id}">🪄 Dividir en pasos chicos</button>`}
    <button class="btn huge" data-act="homeStart" data-id="${t.id}" data-min="5">▶ Solo 5 minutos</button>
    <div class="row">
      <button class="btn ghost" data-act="homeStart" data-id="${t.id}" data-min="25">Foco 25 min</button>
      <button class="btn ghost" data-act="homeDone" data-id="${t.id}">✓ Terminada</button>
    </div>
    <button class="link" data-act="homeSkip" data-id="${t.id}">Ahora no, dame otra →</button>
  </section>`;
}

export function render() {
  const lv = levelInfo();
  const wins = todayWins().filter(w => w.type !== 'shield').length;
  const hb = habitsDoneToday();
  return `
  <header class="top">
    <div>
      <div class="date">${fmtDateLong()}</div>
      <div class="stats"><span>Nv ${lv.lvl}</span><span>🔥 ${state.game.streak.current}</span><span>⛽ ${state.game.fuel}</span></div>
    </div>
    <div class="top-right">
      <button class="icon-btn" data-act="go" data-to="garage" aria-label="Garage">${carSvg(lv.car.color, { size: 58 })}</button>
      <button class="icon-btn" data-act="go" data-to="ajustes" aria-label="Ajustes">⚙️</button>
    </div>
  </header>
  ${eventPill()}
  ${onboarding()}
  ${state.focus ? '' : extraCard()}
  ${focusCard()}
  ${state.focus ? '' : taskCard()}
  <section class="card compact" data-act="go" data-to="habitos">
    <div class="row between"><span>Hábitos hoy</span><b>${hb.done}/${hb.total}</b></div>
    ${bar(hb.total ? hb.done / hb.total : 0, 'var(--good)')}
    <div class="row between muted small"><span>Logros de hoy: ${wins}</span><span>Ver hábitos →</span></div>
  </section>
  <div class="row quick">
    <button class="btn secondary" data-act="go" data-to="capturar">🧠 Vaciar cabeza</button>
    <button class="btn shield" data-act="go" data-to="escudo" aria-label="Escudo">🛡️</button>
  </div>`;
}

export function mount() {
  if (!state.focus) return;
  const id = setInterval(() => {
    const el = document.getElementById('homeFocusLeft');
    if (!el || !state.focus) return clearInterval(id);
    const left = state.focus.endAt - Date.now();
    el.textContent = left > 0 ? fmtClock(left) : '¡Tiempo!';
  }, 1000);
  return () => clearInterval(id);
}

export const actions = {
  homeOnboarded: () => update(s => { s.meta.onboarded = true; }),
  homeStart: el => startFocus(el.dataset.id, Number(el.dataset.min)),
  homeFree: () => startFocus(null, 5),
  homeCheerSeen: () => update(s => { s.partner.seenCheers = s.partner.cheers.length; }),
  homeRoutine: el => {
    startRoutine(el.dataset.id);
    go('rutinas');
  },
  homeStep: el => toggleStep(el.dataset.task, el.dataset.step),
  homeBreak: el => breakdown(el.dataset.id),
  homeDone: el => completeTask(el.dataset.id),
  homeSkip: el => {
    skipIds.push(el.dataset.id);
    update(s => {
      const t = s.tasks.find(x => x.id === el.dataset.id);
      if (t) t.skips = (t.skips || 0) + 1;
      if (s.currentTaskId === el.dataset.id) s.currentTaskId = null;
    });
    if (!suggestTask(skipIds)) skipIds = [];
    rerender();
  },
  go: el => go(el.dataset.to),
};
