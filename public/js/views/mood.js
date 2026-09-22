// Ánimo y energía: check-in de un toque y patrones (a qué hora rindes mejor).
import { state, update } from '../store.js';
import { XP, lastDays, shortDay } from '../game.js';
import { dayKey } from '../util.js';
import { toast } from '../ui.js';
import { reward } from '../actions.js';
import { rerender } from '../router.js';

export const ENERGY = ['🪫', '😪', '🙂', '💪', '⚡'];
export const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const TAGS = ['Dormí mal', 'Dormí bien', 'Estresado', 'Ansioso', 'Motivado', 'Aburrido', 'Entrené', 'Comí mal', 'Con amigos', 'Solo'];
const SLOTS = [['Mañana', 6, 12], ['Mediodía', 12, 15], ['Tarde', 15, 19], ['Noche', 19, 24]];

let draft = { energy: null, mood: null, tags: [] };

// Hay dos momentos para el check-in: antes y después de las 14:00.
export function needsCheckin() {
  const h = new Date().getHours();
  if (h < 7) return false;
  const half = h < 14 ? 0 : 1;
  return !state.mood.some(m => m.day === dayKey() && (new Date(m.t).getHours() < 14 ? 0 : 1) === half);
}

export function saveCheckin(energy, mood, tags = []) {
  update(s => {
    s.mood.unshift({ t: Date.now(), day: dayKey(), energy, mood, tags });
    if (s.mood.length > 500) s.mood.length = 500;
  });
  reward(XP.mood, 'mood', 'Check-in de energía');
}

// Tarjeta compacta para la pantalla Ahora.
export function checkinCard() {
  return `<section class="card compact">
    <div class="row between"><b>¿Cómo está tu energía?</b><button class="link inline" data-act="go" data-to="animo">Más →</button></div>
    <div class="scale">${ENERGY.map((e, i) => `<button data-act="moodQuick" data-v="${i + 1}" aria-label="Energía ${i + 1}">${e}</button>`).join('')}</div>
    <div class="muted tiny">Turbo te propone tareas más cortas cuando andas con poca pila.</div>
  </section>`;
}

function insights() {
  const list = state.mood;
  if (list.length < 4) return '<p class="muted small">Con unos días de check-ins aquí vas a ver a qué hora rindes mejor.</p>';
  const avg = SLOTS.map(([name, a, b]) => {
    const xs = list.filter(m => { const h = new Date(m.t).getHours(); return h >= a && h < b; });
    return { name, n: xs.length, v: xs.length ? xs.reduce((s, m) => s + m.energy, 0) / xs.length : null };
  });
  const best = avg.filter(x => x.n >= 2).sort((a, b) => b.v - a.v)[0];
  const tagCount = {};
  list.filter(m => m.energy <= 2).forEach(m => m.tags.forEach(t => (tagCount[t] = (tagCount[t] || 0) + 1)));
  const lowTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  return `${best ? `<p>⚡ Tu energía suele ser más alta en la <b>${best.name.toLowerCase()}</b>. Deja lo difícil para ese momento.</p>` : ''}
    ${avg.map(x => `<div class="hbar"><span>${x.name}</span><div><div style="width:${x.v ? (x.v / 5) * 100 : 0}%;background:var(--accent)"></div></div><b>${x.v ? x.v.toFixed(1) : '–'}</b></div>`).join('')}
    ${lowTag ? `<p class="muted small">Cuando andas con poca energía, lo que más se repite es: <b>${lowTag[0]}</b>.</p>` : ''}`;
}

function chart() {
  const days = lastDays(14);
  return `<div class="mood-chart">${days.map(d => {
    const xs = state.mood.filter(m => m.day === d);
    const e = xs.length ? xs.reduce((s, m) => s + m.energy, 0) / xs.length : 0;
    const mo = xs.length ? xs.reduce((s, m) => s + m.mood, 0) / xs.length : 0;
    return `<div class="mc-col" title="${d}"><div class="mc-bars"><div class="e" style="height:${e * 20}%"></div><div class="m" style="height:${mo * 20}%"></div></div><span>${shortDay(d)}</span></div>`;
  }).join('')}</div>
  <div class="muted tiny"><span class="dot-key e"></span> energía <span class="dot-key m"></span> ánimo · últimos 14 días</div>`;
}

export function render() {
  const pick = (arr, key) => `<div class="scale">${arr.map((e, i) => `<button class="${draft[key] === i + 1 ? 'on' : ''}" data-act="moodPick" data-k="${key}" data-v="${i + 1}">${e}</button>`).join('')}</div>`;
  return `<header class="top"><h1>⚡ Ánimo y energía</h1></header>
    <section class="card">
      <h3>Energía</h3>${pick(ENERGY, 'energy')}
      <h3>Ánimo</h3>${pick(MOODS, 'mood')}
      <div class="chips pick">${TAGS.map(t => `<button class="chip ${draft.tags.includes(t) ? 'on' : ''}" data-act="moodTag" data-t="${t}">${t}</button>`).join('')}</div>
      <button class="btn" data-act="moodSave">Guardar check-in</button>
    </section>
    <h3 class="group">Tus patrones</h3>
    <section class="card">${chart()}${insights()}</section>`;
}

export const actions = {
  moodQuick: el => {
    const v = Number(el.dataset.v);
    saveCheckin(v, 3);
    toast(v <= 2 ? 'Anotado. Si no hay algo urgente, te propongo cosas más cortas 🫶' : 'Anotado ⚡');
  },
  moodPick: el => {
    draft[el.dataset.k] = Number(el.dataset.v);
    rerender();
  },
  moodTag: el => {
    const t = el.dataset.t;
    draft.tags = draft.tags.includes(t) ? draft.tags.filter(x => x !== t) : [...draft.tags, t];
    el.classList.toggle('on');
  },
  moodSave: () => {
    if (!draft.energy || !draft.mood) return toast('Elige energía y ánimo');
    saveCheckin(draft.energy, draft.mood, draft.tags);
    draft = { energy: null, mood: null, tags: [] };
  },
};
