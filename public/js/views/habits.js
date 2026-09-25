// Contador de hábitos diarios, con racha por hábito y los últimos 7 días.
import { state, update } from '../store.js';
import { XP, habitStreak, habitsDoneToday, lastDays, shortDay } from '../game.js';
import { esc, dayKey, uid } from '../util.js';
import { bar, toast, celebrate } from '../ui.js';
import { reward } from '../actions.js';
import { scheduleReminderSync } from '../api.js';
import { rerender } from '../router.js';

let editing = false;

function habitCard(h) {
  const k = dayKey();
  const n = state.habitLog[k]?.[h.id] || 0;
  const done = n >= h.target;
  const streak = habitStreak(h);
  const dots = lastDays(7).map(d => {
    const ok = (state.habitLog[d]?.[h.id] || 0) >= h.target;
    return `<span class="dot ${ok ? 'on' : ''} ${d === k ? 'today' : ''}" title="${d}">${shortDay(d)}</span>`;
  }).join('');
  const counter = h.target > 1
    ? `<div class="counter"><button class="icon-btn" data-act="habitMinus" data-id="${h.id}" aria-label="Restar">−</button><b>${n}/${h.target}</b><button class="icon-btn plus" data-act="habitPlus" data-id="${h.id}" aria-label="Sumar">+</button></div>`
    : `<button class="check big ${done ? 'on' : ''}" data-act="habitToggle" data-id="${h.id}" aria-label="Hecho"></button>`;
  return `<section class="card habit ${done ? 'is-done' : ''}">
    <div class="row between">
      <div class="habit-name"><span class="emoji">${h.emoji}</span><div><div>${esc(h.name)}</div><div class="muted small">${streak ? `🔥 ${streak} ${streak === 1 ? 'día seguido' : 'días seguidos'}` : 'Hoy puedes empezar la racha'}</div></div></div>
      ${editing ? `<button class="btn danger ghost small" data-act="habitDelete" data-id="${h.id}">Quitar</button>` : counter}
    </div>
    ${h.target > 1 && !editing ? bar(n / h.target, 'var(--good)') : ''}
    <div class="dots">${dots}</div>
  </section>`;
}

export function render() {
  const list = state.habits.filter(h => !h.archived);
  const { done, total } = habitsDoneToday();
  return `<header class="top"><h1>Hábitos</h1><button class="btn ghost small" data-act="habitEdit">${editing ? 'Listo' : 'Editar'}</button></header>
    <section class="card compact"><div class="row between"><span>Hoy</span><b>${done}/${total}</b></div>${bar(total ? done / total : 0, 'var(--good)')}
    <div class="muted small">${done === total && total ? '¡Día completo! 🏆' : 'Cada hábito da +10 XP. Todos juntos, +25 extra.'}</div></section>
    ${list.map(habitCard).join('')}
    ${editing ? `<section class="card">
      <h3>Nuevo hábito</h3>
      <div class="row"><input class="input emoji-in" id="hEmoji" value="⭐" maxlength="4" aria-label="Emoji"><input class="input grow" id="hName" placeholder="ej: Leer 10 minutos"></div>
      <label class="muted small">Veces al día <input class="input" id="hTarget" type="number" min="1" max="20" value="1"></label>
      <button class="btn" data-act="habitAdd">Agregar</button>
    </section>` : ''}`;
}

export function setCount(id, n) {
  const h = state.habits.find(x => x.id === id);
  const k = dayKey();
  const before = state.habitLog[k]?.[id] || 0;
  n = Math.max(0, Math.min(h.target * 3, n));
  update(s => {
    s.habitLog[k] = s.habitLog[k] || {};
    s.habitLog[k][id] = n;
  });
  const aw = (state.habitLog[k]._aw = state.habitLog[k]._aw || {});
  if (before < h.target && n >= h.target && !aw[id]) {
    aw[id] = true;
    reward(XP.habit, 'habit', `${h.emoji} ${h.name}`);
    const all = habitsDoneToday();
    if (all.done === all.total && !aw._all) {
      aw._all = true;
      reward(XP.allHabits, 'habit', 'Todos los hábitos del día');
      celebrate('¡Día de hábitos completo! 🏆');
    }
  }
  scheduleReminderSync();
}

export const actions = {
  habitPlus: el => setCount(el.dataset.id, (state.habitLog[dayKey()]?.[el.dataset.id] || 0) + 1),
  habitMinus: el => setCount(el.dataset.id, (state.habitLog[dayKey()]?.[el.dataset.id] || 0) - 1),
  habitToggle: el => {
    const cur = state.habitLog[dayKey()]?.[el.dataset.id] || 0;
    setCount(el.dataset.id, cur ? 0 : 1);
  },
  habitEdit: () => {
    editing = !editing;
    rerender();
  },
  habitAdd: () => {
    const name = document.getElementById('hName').value.trim();
    if (!name) return toast('Ponle un nombre');
    const emoji = document.getElementById('hEmoji').value.trim() || '⭐';
    const target = Math.max(1, Number(document.getElementById('hTarget').value) || 1);
    update(s => { s.habits.push({ id: uid(), name, emoji, target }); });
    toast('Hábito agregado');
  },
  habitDelete: el => {
    const h = state.habits.find(x => x.id === el.dataset.id);
    if (!confirm(`¿Quitar "${h.name}"? Su historial se conserva.`)) return;
    update(s => { s.habits.find(x => x.id === h.id).archived = true; });
  },
};
