// Pantalla "Ahora": una sola tarea, un solo paso, un botón para arrancar.
import { state, update } from '../store.js';
import { suggestTask, nextStep, nowAndNext, blocksFor, proximoHueco, AREAS, KINDS } from '../planner.js';
import { levelInfo, todayWins, habitsDoneToday } from '../game.js';
import { esc, fmtDateLong, fmtDuration, fmtClock, dueLabel, minToHm, DAY_SHORT } from '../util.js';
import { bar, carSvg, toast } from '../ui.js';
import { startFocus, breakdown, toggleStep, completeTask, focoMin, descansoMin } from '../actions.js';
import { rerender, go } from '../router.js';
import { routineNow, startRoutine } from './routines.js';
import { needsCheckin, checkinCard } from './mood.js';
import { weekFocusCard } from './review.js';
import { ruedas } from './focus.js';

let skipIds = [];

// Tras 3 días sin abrir (o desde el aviso del "día mínimo"): una sola cosa de 2 minutos, sin lista ni culpa.
// Queda pendiente (aunque cierre la app sin tocar nada) hasta que toque "▶ 2 minutos" o "Hoy no".
const MINIMO = 'turbo.minimo';
const guardarMinimo = on => { try { on ? localStorage.setItem(MINIMO, '1') : localStorage.removeItem(MINIMO); } catch {} };
let minimo = (() => { try { return localStorage.getItem(MINIMO) === '1'; } catch { return false; } })();
let calma = false; // tras "Hoy no": sin preguntas extra en esta visita

export function activarMinimo() {
  minimo = true;
  skipIds = [];
  guardarMinimo(true);
}

function minimoCard() {
  const t = suggestTask(skipIds);
  return `<section class="card now minimo">
    <div class="label">VOLVISTE 👋</div>
    <h2 class="task-title">Día mínimo: 2 minutos</h2>
    <p class="muted">${t ? `Solo 2 minutos de <b>${esc(t.title)}</b>. Después puedes parar.` : 'Solo 2 minutos de lo que quieras. Después puedes parar.'}</p>
    <button class="btn huge" data-act="homeMinimo" data-id="${t ? esc(t.id) : ''}">▶ 2 minutos</button>
    <button class="link" data-act="homeMinimoNo">Hoy no</button>
  </section>`;
}

// Evento de Google Calendar en curso: se convierte en foco con un toque. Antes de que empiece basta la
// pastilla de arriba ("en 12 min"): así Ahora nunca muestra dos tarjetas grandes a la vez.
function calendarNow() {
  const now = new Date();
  const ev = blocksFor(now).find(b => b.ext && b.startAt <= now && b.endAt > now);
  if (!ev) return { html: '', running: false };
  const leftMin = (ev.endAt - now) / 60000;
  const min = Math.max(5, Math.min(focoMin(), Math.round(leftMin)));
  return {
    running: true,
    html: `<section class="card now cal-now">
      <div class="label">📅 AHORA EN TU CALENDARIO</div>
      <h2 class="task-title">${esc(ev.title)}</h2>
      <div class="chips"><span class="chip">${ev.start}–${ev.end}</span><span class="chip">quedan ${fmtDuration(leftMin)}</span></div>
      <button class="btn huge" data-act="homeCalFocus" data-title="${esc(ev.title)}" data-min="${min}">▶ ${min} min de foco</button>
      ${ruedas()}
      <p class="muted tiny">Bloque largo = varias vueltas de ${focoMin()} min con ${descansoMin()} de descanso. Al terminar una, "Sigo 15 min más" o partes otra.</p>
    </section>`,
  };
}

// Como mucho UNA tarjeta extra, para no llenar la pantalla: rutina > check-in de energía.
function extraCard() {
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
    // Si al salir queda un hueco, va en la misma línea: una pastilla, no dos.
    const h = proximoHueco();
    const despues = h && !h.ahora && minToHm(h.ini) === current.end ? ` · después, libre hasta las ${minToHm(h.fin)}` : '';
    return `<div class="pill">${KINDS[current.kind]?.emoji || '📌'} En ${esc(current.title)} · termina en ${fmtDuration((current.endAt - now) / 60000)}${despues}</div>`;
  }
  if (next) {
    const min = (next.startAt - now) / 60000;
    const when = min < 24 * 60 ? `en ${fmtDuration(min)}` : `el ${DAY_SHORT[next.startAt.getDay()]} a las ${next.start}`;
    return `<div class="pill ${min < 30 ? 'warn' : ''}">${KINDS[next.kind]?.emoji || '📌'} ${esc(next.title)} ${when}</div>`;
  }
  return `<div class="pill">Día libre de horarios fijos</div>`;
}

// Tu tiempo libre de hoy: en el que estás o el próximo (ver huecos.js).
function huecoPill() {
  const h = proximoHueco();
  if (!h || (nowAndNext().current && !h.ahora)) return ''; // en clase o en un evento, ya va en la pastilla de arriba
  return h.ahora
    ? `<div class="pill free">🟢 Libre ahora hasta las ${minToHm(h.fin)} · ${fmtDuration(h.min)}</div>`
    : `<div class="pill free">🟢 Libre de ${minToHm(h.ini)} a ${minToHm(h.fin)} · ${fmtDuration(h.min)}</div>`;
}

function onboarding() {
  if (state.meta.onboarded) return '';
  return `<section class="card intro">
    <h2>Bienvenido a Turbo 🏎️</h2>
    <ol>
      <li><b>Anota en Capturar 🧠</b> lo que tengas, hablando o escribiendo. Turbo lo ordena.</li>
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
      <button class="btn huge" data-act="go" data-to="capturar">🧠 Anotar</button>
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
    ${ruedas()}
    <div class="row">
      <button class="btn ghost" data-act="homeStart" data-id="${t.id}" data-min="${focoMin()}">Foco ${focoMin()} min</button>
      <button class="btn ghost" data-act="homeDone" data-id="${t.id}">✓ Terminada</button>
    </div>
    <div class="row between"><button class="link" data-act="homeSkip" data-id="${t.id}">Ahora no, dame otra →</button><button class="link" data-act="go" data-to="tareas">Ver todas</button></div>
  </section>`;
}

export function render() {
  const lv = levelInfo();
  const cal = calendarNow();
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
  ${huecoPill()}
  ${onboarding()}
  ${state.focus ? '' : minimo ? minimoCard() : calma ? '' : extraCard()}
  ${focusCard()}
  ${state.focus || minimo ? '' : cal.html}
  ${state.focus || minimo || cal.running ? '' : taskCard()}
  <section class="card compact" data-act="go" data-to="habitos">
    <div class="row between"><span>Hábitos hoy</span><b>${hb.done}/${hb.total}</b></div>
    ${bar(hb.total ? hb.done / hb.total : 0, 'var(--good)')}
    <div class="row between muted small"><span>Logros de hoy: ${wins}</span><span>Ver hábitos →</span></div>
  </section>
  ${weekFocusCard()}`;
}

export function mount() {
  if (!state.focus) {
    // Si un evento de Google empieza con Ahora abierta, su tarjeta aparece sola en ese minuto.
    const now = new Date();
    const prox = blocksFor(now).find(b => b.ext && b.startAt > now);
    if (!prox) return;
    const t = setTimeout(rerender, Math.min(prox.startAt - now + 500, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }
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
  homeMinimo: el => {
    minimo = false;
    guardarMinimo(false);
    startFocus(el.dataset.id || null, 2, null, { minimo: true });
  },
  homeMinimoNo: () => {
    minimo = false;
    calma = true;
    guardarMinimo(false);
    toast('Dale. Aquí queda para cuando quieras.');
    rerender();
  },
  homeCalFocus: el => startFocus(null, Number(el.dataset.min), el.dataset.title),
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
