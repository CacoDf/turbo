// Arranque de Turbo: pantallas, navegación, eventos y sincronización.
import { state, subscribe } from './store.js';
import { checkStreak } from './game.js';
import { closeSheet, unlockAudio, pararAlarma } from './ui.js';
import { setRenderer, route } from './router.js';
import { pullBackup, scheduleBackup, flushBackup, marcarVisto, actualizarBadge } from './api.js';
import { refreshExternal } from './calendar.js';
import { traerBandeja } from './bandeja.js';
import * as home from './views/home.js';
import * as focus from './views/focus.js';
import * as capture from './views/capture.js';
import * as tasks from './views/tasks.js';
import * as habits from './views/habits.js';
import * as day from './views/day.js';
import * as garage from './views/garage.js';
import * as settings from './views/settings.js';
import * as routines from './views/routines.js';
import * as mood from './views/mood.js';
import * as studies from './views/studies.js';
import * as review from './views/review.js';
import * as calendar from './calendar.js';

// Plata, Pareja, Escudo, Metas, Desafíos y Secretaria están congelados (Fase 1): sus archivos y datos siguen en el repo,
// pero no se cargan ni tienen ruta. Una ruta congelada cae en Ahora.
const VIEWS = {
  ahora: home, foco: focus, capturar: capture, tareas: tasks, habitos: habits, dia: day,
  garage, ajustes: settings, rutinas: routines, animo: mood, estudios: studies, revision: review,
};
const ACTIONS = Object.assign({ closeSheet }, ...[...Object.values(VIEWS), calendar].map(v => v.actions || {}));

const NAV = [
  ['ahora', '🏁', 'Ahora'],
  ['dia', '🗓️', 'Día'],
  ['capturar', '🧠', 'Capturar'],
  ['foco', '⏱️', 'Foco'],
];
// Subpantallas: se marcan bajo la pestaña desde donde se llega a ellas.
const TAB_OF = { tareas: 'ahora', animo: 'ahora', garage: 'ahora', ajustes: 'ahora', revision: 'dia', habitos: 'dia', rutinas: 'dia', estudios: 'dia' };

const root = document.getElementById('app');
const nav = document.getElementById('nav');
let unmount = null;
let lastRoute = null;

function render() {
  const r = VIEWS[route()] ? route() : 'ahora';
  const view = VIEWS[r];
  unmount?.();
  unmount = null;
  // Al cambiar de pestaña, primero arriba y recién después el contenido nuevo: así una pantalla corta no hereda el scroll de una larga.
  if (r !== lastRoute) {
    window.scrollTo(0, 0);
    lastRoute = r;
  }
  root.innerHTML = view.render();
  nav.hidden = r === 'foco' && !!state.focus; // con una sesión en curso, la barra se esconde; sin sesión, Foco es una pestaña normal
  const tab = TAB_OF[r] || r;
  nav.innerHTML = NAV.map(([id, icon, label]) => `<a href="#/${id}" class="${id === tab ? 'on' : ''}"><span>${icon}</span>${label}</a>`).join('');
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
  actualizarBadge();
});

// Al abrir o volver a la app: el servidor deja de insistir. Si pasaron 3 días (o se llegó desde el aviso
// del "día mínimo"), Ahora ofrece 2 minutos en vez de la lista de siempre.
const TRES_DIAS = 3 * 86400000;
function alAbrir() {
  const antes = marcarVisto();
  const desdeAviso = new URLSearchParams(location.search).has('minimo');
  if (desdeAviso) history.replaceState(null, '', location.pathname + location.hash);
  if (desdeAviso || (antes && Date.now() - antes >= TRES_DIAS)) home.activarMinimo();
}

// Cualquier toque apaga la alarma del foco (en iOS, tocar algo que no es botón no siempre genera "click").
document.addEventListener('pointerdown', pararAlarma);

// Un solo manejador para todos los botones: data-act="nombreAccion".
document.addEventListener('click', ev => {
  unlockAudio();
  pararAlarma();
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

// Al volver a la app (desde otra app o al desbloquear): revisar racha y refrescar. Al salir: subir el respaldo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return flushBackup();
  alAbrir();
  checkStreak();
  // Primero el respaldo, después la bandeja del Atajo y al final Google (que puede mover lo del Atajo).
  pullBackup().then(traerBandeja).then(() => refreshExternal());
  queueRender();
});

async function boot() {
  alAbrir();
  checkStreak();
  render();
  actualizarBadge();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW', e));
  }
  if (await pullBackup()) queueRender();
  scheduleBackup();
  await traerBandeja();
  refreshExternal();
}

boot();
