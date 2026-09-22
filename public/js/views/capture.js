// "Vaciar la cabeza": escribir o dictar en desorden y convertirlo en tareas.
import { AREAS, localParse } from '../planner.js';
import { XP } from '../game.js';
import { esc } from '../util.js';
import { toast } from '../ui.js';
import { hasServer, aiCapture } from '../api.js';
import { addTasks, reward } from '../actions.js';
import { rerender, go } from '../router.js';

let draft = '';
let items = null;
let busy = false;

const MINUTES = [5, 10, 15, 25, 45, 60, 90, 120];

function itemRow(it, i) {
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
      <button class="icon-btn" data-act="capRemove" data-i="${i}" aria-label="Quitar">✕</button>
    </div>
  </div>`;
}

export function render() {
  if (items) {
    return `<header class="top"><h1>Revisa y guarda</h1></header>
      <p class="muted">Corrige lo que quieras. Si algo no es tarea, quítalo con ✕.</p>
      ${items.map(itemRow).join('')}
      <button class="btn huge" data-act="capSave" ${items.length ? '' : 'disabled'}>Guardar ${items.length} ${items.length === 1 ? 'tarea' : 'tareas'}</button>
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
  if (!draft) ta.focus();
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
    if (it) it[el.dataset.f] = el.value;
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
    addTasks(clean);
    reward(XP.capture, 'capture', `Anotaste ${clean.length} ${clean.length === 1 ? 'cosa' : 'cosas'}`);
    draft = '';
    items = null;
    go('ahora');
  },
};
