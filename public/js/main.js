// Arranque de Turbo: pantallas, navegación, eventos y sincronización.
import { subscribe } from './store.js';
import { checkStreak } from './game.js';
import { closeSheet, unlockAudio } from './ui.js';
import { setRenderer, route } from './router.js';
import { pullBackup, scheduleBackup, scheduleReminderSync } from './api.js';
import * as home from './views/home.js';
import * as focus from './views/focus.js';
import * as capture from './views/capture.js';
import * as tasks from './views/tasks.js';
import * as habits from './views/habits.js';
import * as day from './views/day.js';
import * as garage from './views/garage.js';
import * as shield from './views/shield.js';
import * as settings from './views/settings.js';

const VIEWS = { ahora: home, foco: focus, capturar: capture, tareas: tasks, habitos: habits, dia: day, garage, escudo: shield, ajustes: settings };
const ACTIONS = Object.assign({ closeSheet }, ...Object.values(VIEWS).map(v => v.actions || {}));

const NAV = [
  ['ahora', '🏁', 'Ahora'],
  ['tareas', '📋', 'Tareas'],
  ['habitos', '🔁', 'Hábitos'],
  ['dia', '🗓️', 'Día'],
  ['garage', '🏎️', 'Garage'],
];

const root = document.getElementById('app');
const nav = document.getElementById('nav');
let unmount = null;
let lastRoute = null;

function render() {
  const r = VIEWS[route()] ? route() : 'ahora';
  const view = VIEWS[r];
  unmount?.();
  unmount = null;
  root.innerHTML = view.render();
  if (r !== lastRoute) {
    window.scrollTo(0, 0);
    lastRoute = r;
  }
  nav.hidden = r === 'foco';
  nav.innerHTML = NAV.map(([id, icon, label]) => `<a href="#/${id}" class="${id === r ? 'on' : ''}"><span>${icon}</span>${label}</a>`).join('');
  unmount = view.mount?.() || null;
}

let queued = false;
function queueRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render();
  });
}

setRenderer(queueRender);
window.addEventListener('hashchange', () => {
  closeSheet();
  render();
});

subscribe(() => {
  queueRender();
  scheduleBackup();
});

// Un solo manejador para todos los botones: data-act="nombreAccion".
document.addEventListener('click', ev => {
  unlockAudio();
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return console.warn('Acción desconocida', el.dataset.act);
  if (el.tagName === 'BUTTON' || el.tagName === 'A') ev.preventDefault();
  fn(el, ev);
});

document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-change]');
  if (el) ACTIONS[el.dataset.change]?.(el, ev);
});

// Al volver a la app (desde otra app o al desbloquear): revisar racha y refrescar.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  checkStreak();
  pullBackup();
  scheduleReminderSync();
  queueRender();
});

async function boot() {
  checkStreak();
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW', e));
  }
  if (await pullBackup()) queueRender();
  scheduleReminderSync();
  scheduleBackup();
}

boot();
