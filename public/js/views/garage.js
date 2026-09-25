// Garage: tu auto actual, nivel, tienda de premios con bencina y lo que SÍ hiciste hoy.
import { state, update } from '../store.js';
import { CARS, levelInfo, xpForLevel, todayWins } from '../game.js';
import { esc, uid } from '../util.js';
import { carSvg, bar, toast, celebrate } from '../ui.js';
import { rerender } from '../router.js';
import { challengesCard } from '../challenges.js';

let editRewards = false;

const TYPE_EMOJI = { task: '✅', step: '👣', focus: '⏱️', habit: '🔁', capture: '🧠', routine: '🔄', money: '💸', mood: '⚡', study: '📚', goal: '🎯', assistant: '🤖', review: '🧭', challenge: '🏁' };

export function render() {
  const lv = levelInfo();
  const st = state.game.streak;
  const wins = todayWins().filter(w => w.type !== 'shield');
  const nextCar = CARS[lv.lvl];
  return `<header class="top"><h1>Garage</h1></header>
    <section class="card hero">
      <div class="center">${carSvg(lv.car.color, { size: 240 })}</div>
      <h2 class="center">${esc(lv.car.name)}</h2>
      <div class="center muted">Nivel ${lv.lvl} · ${lv.car.hp} HP</div>
      ${bar(lv.pct)}
      <div class="row between small muted"><span>${lv.into}/${lv.need} XP</span><span>${nextCar ? `Próximo: ${esc(nextCar.name)}` : '¡Garage completo!'}</span></div>
    </section>

    <div class="row stats-row">
      <section class="card compact center"><div class="big-num">⛽ ${state.game.fuel}</div><div class="muted small">bencina</div></section>
      <section class="card compact center"><div class="big-num">🔥 ${st.current}</div><div class="muted small">racha (récord ${st.best})</div></section>
      <section class="card compact center"><div class="big-num">🛟 ${st.freezes}</div><div class="muted small">comodines</div></section>
    </div>
    <p class="muted small">Los comodines salvan tu racha si fallas un día. Ganas 1 por semana (máx. 2).</p>

    ${challengesCard()}
    ${state.trophies.length ? `<section class="card compact"><div class="label">TROFEOS</div>${state.trophies.map(t => `<span class="chip">🏆 ${esc(t.theme)}</span>`).join(' ')}</section>` : ''}

    <h3 class="group">Tienda de premios <button class="link inline" data-act="rewEdit">${editRewards ? 'Listo' : 'Editar'}</button></h3>
    ${state.rewards.map(r => `<div class="card reward row between">
      <span>${r.emoji} ${esc(r.name)}</span>
      ${editRewards ? `<button class="btn danger ghost small" data-act="rewDel" data-id="${r.id}">Quitar</button>`
        : `<button class="btn small ${state.game.fuel >= r.cost ? '' : 'ghost'}" data-act="rewBuy" data-id="${r.id}">⛽ ${r.cost}</button>`}
    </div>`).join('')}
    ${editRewards ? `<section class="card">
      <div class="row"><input class="input emoji-in" id="rEmoji" value="🎁" maxlength="4" aria-label="Emoji"><input class="input grow" id="rName" placeholder="ej: Ir al cine"></div>
      <label class="muted small">Costo en bencina <input class="input" id="rCost" type="number" min="10" step="10" value="100"></label>
      <button class="btn" data-act="rewAdd">Agregar premio</button></section>` : ''}

    <h3 class="group">Lo que SÍ hiciste hoy</h3>
    <section class="card">${wins.length ? wins.slice(0, 40).map(w => `<div class="win">${TYPE_EMOJI[w.type] || '⭐'} ${esc(w.text)} <span class="muted small">+${w.xp}</span></div>`).join('') : '<p class="muted">Todavía nada, y está bien. El primer paso cuenta.</p>'}</section>

    <h3 class="group">Colección</h3>
    <div class="cars">${CARS.map((c, i) => {
      const unlocked = lv.lvl > i;
      return `<div class="car-cell ${unlocked ? '' : 'locked'}">${carSvg(c.color, { size: 92, locked: !unlocked })}<div class="small">${unlocked ? esc(c.name) : `Nivel ${i + 1}`}</div>${unlocked ? '' : `<div class="muted tiny">${xpForLevel(i + 1)} XP</div>`}</div>`;
    }).join('')}</div>`;
}

export const actions = {
  rewBuy: el => {
    const r = state.rewards.find(x => x.id === el.dataset.id);
    if (state.game.fuel < r.cost) return toast(`Te faltan ${r.cost - state.game.fuel} de bencina ⛽`);
    if (!confirm(`¿Canjear "${r.name}" por ${r.cost} de bencina?`)) return;
    update(s => {
      s.game.fuel -= r.cost;
      s.redemptions.unshift({ id: uid(), rewardId: r.id, name: r.name, t: Date.now() });
    });
    celebrate(`${r.emoji} ¡Disfrútalo sin culpa!`);
  },
  rewEdit: () => {
    editRewards = !editRewards;
    rerender();
  },
  rewDel: el => update(s => { s.rewards = s.rewards.filter(r => r.id !== el.dataset.id); }),
  rewAdd: () => {
    const name = document.getElementById('rName').value.trim();
    if (!name) return toast('Ponle un nombre');
    const emoji = document.getElementById('rEmoji').value.trim() || '🎁';
    const cost = Math.max(10, Number(document.getElementById('rCost').value) || 100);
    update(s => { s.rewards.push({ id: uid(), name, emoji, cost }); });
  },
};
