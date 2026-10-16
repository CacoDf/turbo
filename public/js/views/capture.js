// "Vaciar la cabeza": escribir o dictar en desorden y convertirlo en tareas.
import { AREAS, localParse } from '../planner.js';
import { XP } from '../game.js';
import { esc, dayKey, validHm, defaultEnd } from '../util.js';
import { toast } from '../ui.js';
import { hasServer, aiCapture } from '../api.js';
import { addTasks, addEvents, reward } from '../actions.js';
import { setDayOffset } from './day.js';
import { rerender, go } from '../router.js';

let draft = '';
let items = null;
let busy = false;

const MINUTES = [5, 10, 15, 25, 45, 60, 90, 120];

const isEvent = it => it.kind === 'evento';

function itemRow(it, i) {
  const rm = `<button class="icon-btn" data-act="capRemove" data-i="${i}" aria-label="Quitar">✕</button>`;
  if (isEvent(it)) {
    return `<div class="card item">
      <div class="label">📅 EVENTO</div>
      <input class="input" value="${esc(it.title)}" data-change="capField" data-i="${i}" data-f="title">
      <div class="row wrap">
        <input class="input" type="date" value="${it.date || ''}" data-change="capField" data-i="${i}" data-f="date">
        <input class="input" type="time" value="${it.start || ''}" data-change="capField" data-i="${i}" data-f="start" aria-label="Hora">
        ${rm}
      </div>
    </div>`;
  }
  return `<div class="card item">
    <input class="input" value="${esc(it.title)}" data-change="capField" data-i="${i}" data-f="title">
    <div class="row wrap">
      <select class="input" data-change="capField" data-i="${i}" data-f="area">
        ${Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${k === it.area ? 'selected' : ''}>${a.emoji} ${a.label}</option>`).join('')}
      </select>
      <select class="input" data-change="capField" data-i="${i}" data-f="minutes">
        ${MINUTES.map(m => `<option value="${m}" ${m === Number(it.minutes) ? 'selected' : ''}>${m} min</option>`).join('')}
      </select>
      <input class="input" type="date" value="${it.due || ''}" data-change="capField" data-i="${i}" data-f="due">
      <input class="input" type="time" value="" data-change="capField" data-i="${i}" data-f="start" aria-label="Ponle hora para que sea evento" title="Ponle hora para que sea evento">
      ${rm}
    </div>
  </div>`;
}

const saveLabel = () => {
  const ev = items.filter(isEvent).length;
  const ta = items.length - ev;
  return [ev && `${ev} ${ev === 1 ? 'evento' : 'eventos'}`, ta && `${ta} ${ta === 1 ? 'tarea' : 'tareas'}`].filter(Boolean).join(' y ');
};

export function render() {
  if (items) {
    return `<header class="top"><h1>Revisa y guarda</h1></header>
      <p class="muted">Corrige lo que quieras. Si algo no va, quítalo con ✕. Con hora es evento y sale en Día.</p>
      ${items.map(itemRow).join('')}
      <button class="btn huge" data-act="capSave" ${items.length ? '' : 'disabled'}>Guardar ${saveLabel()}</button>
      <button class="link" data-act="capBack">← Volver a escribir</button>`;
  }
  return `<header class="top"><h1>🧠 Vaciar la cabeza</h1></header>
    <p class="muted">Escribe o dicta (🎤 en el teclado) todo lo que tengas dando vueltas. En desorden, sin pensar. Una idea por línea ayuda, pero no es obligatorio.</p>
    <textarea id="capText" class="input area" rows="9" placeholder="ej: estudiar para la prueba de finanzas del viernes, pagar la cuenta del celu, comprar proteína, mandar el cv...">${esc(draft)}</textarea>
    <button class="btn huge" data-act="capParse" ${busy ? 'disabled' : ''}>${busy ? 'Ordenando…' : '✨ Ordenar'}</button>
    <p class="muted small center">${hasServer() ? 'La IA separa las tareas y detecta fechas.' : 'Sin servidor conectado: se ordena de forma básica (una tarea por línea).'}</p>`;
}

export function mount() {
  const ta = document.getElementById('capText');
  if (!ta) return;
  ta.addEventListener('input', () => (draft = ta.value));
  // Sin ta.focus(): en iPhone abrir el teclado solo descuadra la barra de pestañas.
}

export const actions = {
  capParse: async () => {
    const text = draft.trim();
    if (!text) return toast('Escribe algo primero 🙂');
    busy = true;
    rerender();
    let result = null;
    if (hasServer()) {
      try {
        result = await aiCapture(text);
      } catch (e) {
        console.warn(e);
        toast('La IA no respondió; lo ordené de forma básica.');
      }
    }
    items = result?.length ? result : localParse(text);
    busy = false;
    rerender();
  },
  capField: el => {
    const it = items?.[Number(el.dataset.i)];
    if (!it) return;
    const f = el.dataset.f;
    it[f] = el.value;
    if (f !== 'start') return;
    // Poner o quitar la hora convierte la tarea en evento (y al revés).
    if (isEvent(it) && !validHm(el.value)) {
      Object.assign(it, { kind: undefined, area: 'personal', minutes: 25, due: it.date || null, start: undefined, end: undefined });
    } else if (!isEvent(it) && validHm(el.value)) {
      Object.assign(it, { kind: 'evento', date: it.due || dayKey(), end: defaultEnd(el.value) });
    } else if (isEvent(it)) {
      it.end = defaultEnd(el.value);
    }
    rerender();
  },
  capRemove: el => {
    items.splice(Number(el.dataset.i), 1);
    rerender();
  },
  capBack: () => {
    items = null;
    rerender();
  },
  capSave: () => {
    const clean = items.filter(i => i.title?.trim());
    const events = clean.filter(isEvent);
    const tasks = clean.filter(i => !isEvent(i));
    const dates = addEvents(events);
    addTasks(tasks);
    const label = [dates.length && `${dates.length} ${dates.length === 1 ? 'evento' : 'eventos'}`, tasks.length && `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'}`].filter(Boolean).join(' y ');
    reward(XP.capture, 'capture', `Anotaste ${label || 'algo'}`);
    draft = '';
    items = null;
    if (dates.length) {
      setDayOffset(dates.sort()[0]);
      go('dia');
    } else {
      go('ahora');
    }
  },
};
