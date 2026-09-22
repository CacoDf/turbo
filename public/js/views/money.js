// Plata: anotar gastos en segundos, ver en qué se va, detectar gastos hormiga
// y frenar compras impulsivas con la lista "¿Lo necesito?" (espera de 24 h).
// Estos datos no se comparten con la pareja ni se mandan a la IA.
import { state, update } from '../store.js';
import { XP } from '../game.js';
import { esc, uid, addDays, dayKey, parseDayKey } from '../util.js';
import { bar, toast } from '../ui.js';
import { reward } from '../actions.js';
import { rerender } from '../router.js';

export const CATS = {
  comida: ['🍔', 'Comida'],
  delivery: ['🛵', 'Delivery'],
  transporte: ['🚌', 'Transporte'],
  salidas: ['🎉', 'Salidas'],
  gym: ['💪', 'Gym y suples'],
  ropa: ['👕', 'Ropa'],
  apps: ['📱', 'Apps y suscripciones'],
  ocio: ['🎮', 'Ocio'],
  u: ['📚', 'U'],
  casa: ['🏠', 'Casa'],
  otro: ['❓', 'Otro'],
};

const SMALL = 5000; // "gasto hormiga": menos de $5.000
const WAIT_MS = 24 * 3600000;

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

let cat = 'comida';
let tab = 'gastos';

// Lunes de la semana (inicio de semana en Chile).
function weekStart(offsetWeeks = 0) {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  const m = addDays(d, -dow + offsetWeeks * 7);
  m.setHours(0, 0, 0, 0);
  return m.getTime();
}

function inWeek(offset) {
  const a = weekStart(offset);
  const b = a + 7 * 86400000;
  return state.money.expenses.filter(e => e.t >= a && e.t < b);
}

const sum = list => list.reduce((a, e) => a + e.amount, 0);

function addForm() {
  return `<section class="card">
    <div class="money-input"><span>$</span><input class="input" id="mAmount" inputmode="numeric" pattern="[0-9]*" placeholder="0" autocomplete="off"></div>
    <div class="chips pick">${Object.entries(CATS).map(([k, [e, l]]) => `<button class="chip ${k === cat ? 'on' : ''}" data-act="mCat" data-c="${k}">${e} ${l}</button>`).join('')}</div>
    <input class="input" id="mNote" placeholder="Nota (opcional)">
    <button class="btn" data-act="mAdd">Anotar gasto</button>
  </section>`;
}

function summary() {
  const now = inWeek(0);
  const prev = inWeek(-1);
  const total = sum(now);
  const byCat = {};
  now.forEach(e => (byCat[e.cat] = (byCat[e.cat] || 0) + e.amount));
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const small = now.filter(e => e.amount < SMALL);
  const budget = state.money.weekBudget;
  const diff = total - sum(prev);
  return `<section class="card">
    <div class="label">ESTA SEMANA</div>
    <div class="big-num">${clp(total)}</div>
    <div class="muted small">${prev.length ? `${diff > 0 ? '▲' : '▼'} ${clp(Math.abs(diff))} vs la semana pasada` : 'Primera semana registrada'}</div>
    ${budget ? `${bar(total / budget, total > budget ? 'var(--bad)' : total > budget * 0.8 ? 'var(--fuel)' : 'var(--good)')}
      <div class="muted small">${total > budget ? `Te pasaste por ${clp(total - budget)}` : `Te quedan ${clp(budget - total)} de ${clp(budget)}`}</div>` : ''}
    ${top.length ? `<div class="cat-bars">${top.map(([k, v]) => `<div class="hbar"><span>${CATS[k]?.[0] || '❓'} ${CATS[k]?.[1] || k}</span><div><div style="width:${(v / top[0][1]) * 100}%;background:var(--fuel)"></div></div><b>${clp(v)}</b></div>`).join('')}</div>` : ''}
    ${small.length >= 3 ? `<p class="warn-text small">🐜 ${small.length} gastos hormiga (menos de ${clp(SMALL)}) suman <b>${clp(sum(small))}</b> esta semana.</p>` : ''}
  </section>`;
}

function recent() {
  const list = [...state.money.expenses].sort((a, b) => b.t - a.t).slice(0, 25);
  if (!list.length) return '<p class="muted center">Todavía no anotas gastos. Anota el próximo apenas pagues: toma 5 segundos.</p>';
  let lastDay = '';
  return `<h3 class="group">Últimos gastos</h3><section class="card">${list.map(e => {
    const k = dayKey(new Date(e.t));
    const head = k !== lastDay ? `<div class="muted tiny day-head">${k === dayKey() ? 'Hoy' : parseDayKey(k).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric' })}</div>` : '';
    lastDay = k;
    return `${head}<div class="row between win"><span>${CATS[e.cat]?.[0] || '❓'} ${esc(e.note || CATS[e.cat]?.[1] || '')}</span><span class="row"><b>${clp(e.amount)}</b><button class="icon-btn" data-act="mDel" data-id="${e.id}" aria-label="Borrar">✕</button></span></div>`;
  }).join('')}</section>`;
}

function wishlist() {
  const w = state.money.wishlist;
  const pending = w.filter(x => !x.decided);
  const saved = sum(w.filter(x => x.decided === 'skip').map(x => ({ amount: x.price })));
  return `<p class="muted">¿Ganas de comprar algo que no estaba planeado? Anótalo aquí y espera 24 horas. Si mañana todavía lo quieres, adelante. Si no, te ahorraste la plata.</p>
    <section class="card">
      <input class="input" id="wName" placeholder="¿Qué quieres comprar?">
      <div class="money-input"><span>$</span><input class="input" id="wPrice" inputmode="numeric" pattern="[0-9]*" placeholder="Precio"></div>
      <button class="btn" data-act="wAdd">Dejarlo esperando 24 h</button>
    </section>
    ${saved ? `<section class="card compact center">💰 Te has ahorrado <b>${clp(saved)}</b> no comprando por impulso</section>` : ''}
    ${pending.map(x => {
      const left = x.t + WAIT_MS - Date.now();
      return `<section class="card">
        <div class="row between"><b>${esc(x.name)}</b><span>${clp(x.price)}</span></div>
        ${left > 0 ? `<div class="muted small">⏳ Espera ${Math.ceil(left / 3600000)} h más antes de decidir</div>`
          : `<p>¿Todavía lo quieres?</p><div class="row"><button class="btn ghost" data-act="wDecide" data-id="${x.id}" data-d="buy">Sí, lo compro</button><button class="btn" data-act="wDecide" data-id="${x.id}" data-d="skip">Ya no 💰</button></div>`}
      </section>`;
    }).join('')}`;
}

function budgetCard() {
  return `<section class="card">
    <h3>Presupuesto semanal</h3>
    <p class="muted small">Opcional. Un tope para la semana y una barra que se pone amarilla y roja al acercarte.</p>
    <div class="money-input"><span>$</span><input class="input" id="mBudget" inputmode="numeric" pattern="[0-9]*" value="${state.money.weekBudget || ''}" placeholder="ej: 50000"></div>
    <button class="btn ghost" data-act="mBudget">Guardar</button>
  </section>`;
}

export function render() {
  return `<header class="top"><h1>💸 Plata</h1></header>
    <div class="tabs">
      <button class="${tab === 'gastos' ? 'on' : ''}" data-act="mTab" data-t="gastos">Gastos</button>
      <button class="${tab === 'deseos' ? 'on' : ''}" data-act="mTab" data-t="deseos">¿Lo necesito?</button>
      <button class="${tab === 'ajustes' ? 'on' : ''}" data-act="mTab" data-t="ajustes">Presupuesto</button>
    </div>
    ${tab === 'gastos' ? addForm() + summary() + recent() : tab === 'deseos' ? wishlist() : budgetCard()}`;
}

const readAmount = id => Math.round(Number(String(document.getElementById(id)?.value || '').replace(/[^\d]/g, '')));

export const actions = {
  mTab: el => {
    tab = el.dataset.t;
    rerender();
  },
  mCat: el => {
    cat = el.dataset.c;
    document.querySelectorAll('[data-act="mCat"]').forEach(b => b.classList.toggle('on', b === el));
  },
  mAdd: () => {
    const amount = readAmount('mAmount');
    if (!amount) return toast('Escribe el monto');
    const note = document.getElementById('mNote').value.trim();
    update(s => { s.money.expenses.push({ id: uid(), t: Date.now(), amount, cat, note }); });
    reward(XP.expense, 'money', `Anotaste un gasto`);
  },
  mDel: el => {
    if (!confirm('¿Borrar este gasto?')) return;
    update(s => { s.money.expenses = s.money.expenses.filter(e => e.id !== el.dataset.id); });
  },
  mBudget: () => {
    const v = readAmount('mBudget');
    update(s => { s.money.weekBudget = v || null; });
    toast(v ? 'Presupuesto guardado' : 'Presupuesto quitado');
  },
  wAdd: () => {
    const name = document.getElementById('wName').value.trim();
    const price = readAmount('wPrice');
    if (!name) return toast('¿Qué quieres comprar?');
    update(s => { s.money.wishlist.unshift({ id: uid(), name, price, t: Date.now(), decided: null }); });
    toast('Anotado. Mañana decides con la cabeza fría 🧊');
  },
  wDecide: el => {
    const d = el.dataset.d;
    const item = state.money.wishlist.find(x => x.id === el.dataset.id);
    update(s => { s.money.wishlist.find(x => x.id === item.id).decided = d; });
    if (d === 'skip') reward(XP.wishSkip, 'money', `Te ahorraste ${clp(item.price)}`);
    else toast('Disfrútalo, lo pensaste bien 👌');
  },
};
