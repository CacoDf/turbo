// Tu día en una línea: horario fijo, la hora actual y cuánto falta para lo siguiente.
import { state, update } from '../store.js';
import { blocksFor, allDayFor, huecosDel, KINDS, AREAS, nowAndNext } from '../planner.js';
import { esc, addDays, dayKey, parseDayKey, daysBetween, fmtDateLong, fmtDuration, hmToMin, minToHm, DAY_SHORT, uid } from '../util.js';
import { refreshExternal } from '../calendar.js';
import { toast } from '../ui.js';
import { rerender } from '../router.js';

let offset = 0;
let editing = false;
let refreshing = false;

const MAX_AHEAD = 60; // días hacia adelante que se pueden mirar (lo que trae Google Calendar)

// Abre Día en una fecha concreta (YYYY-MM-DD): al guardar un evento, se ve dónde quedó.
export function showDay(key) {
  offset = Math.max(-7, Math.min(MAX_AHEAD, daysBetween(dayKey(), key)));
  editing = false;
}

// Al salir de Día vuelve a hoy: la próxima vez parte en "ahora", no en el último día mirado.
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#/dia')) {
    offset = 0;
    editing = false;
  }
});
const START = 7 * 60;
const END = 24 * 60;
const PX = 0.9; // píxeles por minuto

// Bloques que se topan van lado a lado (como en Google Calendar), no uno encima del otro.
// Cada grupo de bloques que se pisan reparte el ancho en tantas columnas como necesite.
function lanes(blocks) {
  const out = [];
  let group = [];
  let groupEnd = -1;
  let colEnds = [];
  const close = () => { group.forEach(x => (x.cols = colEnds.length)); group = []; colEnds = []; };
  for (const b of blocks) {
    const ini = hmToMin(b.start);
    const fin = Math.max(ini + 1, hmToMin(b.end), ini + 22 / PX); // lo que mide en pantalla (mínimo 22 px)
    if (ini >= groupEnd) close();
    let col = colEnds.findIndex(e => e <= ini);
    if (col < 0) col = colEnds.push(0) - 1;
    colEnds[col] = fin;
    groupEnd = Math.max(groupEnd, fin);
    const x = { b, col, cols: 1 };
    group.push(x);
    out.push(x);
  }
  close();
  return out;
}

function timeline(date) {
  const blocks = blocksFor(date);
  const isToday = offset === 0;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const hours = [];
  for (let m = START; m <= END; m += 60) hours.push(`<div class="hour" style="top:${(m - START) * PX}px">${String(m / 60 % 24).padStart(2, '0')}:00</div>`);
  const items = lanes(blocks).map(({ b, col, cols }) => {
    const top = (Math.max(START, hmToMin(b.start)) - START) * PX;
    const h = Math.max(22, (hmToMin(b.end) - hmToMin(b.start)) * PX);
    const pos = cols > 1 ? `;left:calc(8px + (100% - 8px) * ${col} / ${cols});right:auto;width:calc((100% - 8px) / ${cols} - 4px)` : '';
    return `<div class="block k-${b.kind}" style="top:${top}px;height:${h}px${pos}"><b>${KINDS[b.kind]?.emoji || ''} ${esc(b.title)}</b><span>${b.start}–${b.end}</span></div>`;
  }).join('');
  // Huecos libres (desde 30 min, entre 08:00 y 20:00): punteados, detrás de los eventos.
  const libres = huecosDel(date).map(h => `<div class="block hueco" style="top:${(h.ini - START) * PX}px;height:${h.min * PX}px">
    <b>Libre · ${fmtDuration(h.min)}</b><span>${minToHm(h.ini)}–${minToHm(h.fin)}</span></div>`).join('');
  const nowLine = isToday && nowMin >= START ? `<div class="now-line" style="top:${(nowMin - START) * PX}px"><span>ahora</span></div>` : '';
  return `<div class="timeline" style="height:${(END - START) * PX + 10}px">${hours.join('')}${libres}${items}${nowLine}</div>`;
}

function dueList(date) {
  const k = dayKey(date);
  const list = state.tasks.filter(t => !t.done && (t.due === k || (offset === 0 && t.today && !t.due)));
  const allDay = allDayFor(date);
  const exams = state.exams.filter(e => !e.done && e.date === k);
  if (!list.length && !allDay.length && !exams.length) return '';
  return `<section class="card compact"><div class="label">PARA ESTE DÍA</div>
    ${exams.map(e => `<div>📚 <b>${esc(e.title)}</b></div>`).join('')}
    ${allDay.map(e => `<div>📅 ${esc(e.title)}</div>`).join('')}
    ${list.map(t => `<div>${AREAS[t.area]?.emoji || '✨'} ${esc(t.title)} <span class="muted small">· ${fmtDuration(t.minutes)}</span></div>`).join('')}</section>`;
}

function editor() {
  const kinds = Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`).join('');
  return `<section class="card">
    <h3>Tu horario fijo</h3>
    ${state.schedule.filter(b => !b.date || b.date >= dayKey()).map(b => `<div class="row between sched-row">
      <span>${KINDS[b.kind]?.emoji || ''} <b>${esc(b.title)}</b> <span class="muted small">${b.date ? `${DAY_SHORT[parseDayKey(b.date).getDay()]} ${parseDayKey(b.date).getDate()}/${parseDayKey(b.date).getMonth() + 1} (una vez)` : b.days.map(d => DAY_SHORT[d]).join(', ')} · ${b.start}–${b.end}</span></span>
      <button class="icon-btn" data-act="dayDel" data-id="${b.id}" aria-label="Borrar">✕</button></div>`).join('') || '<p class="muted">Sin bloques todavía.</p>'}
    <h3>Agregar bloque</h3>
    <div class="row"><input class="input grow" id="bTitle" placeholder="ej: Gym"><select class="input" id="bKind">${kinds}</select></div>
    <div class="muted small">Se repite cada semana los días:</div>
    <div class="days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" value="${d}" class="bDay"><span>${DAY_SHORT[d]}</span></label>`).join('')}</div>
    <label class="muted small">…o solo una vez, el día <input class="input" type="date" id="bDate" min="${dayKey()}"></label>
    <div class="row"><label class="grow muted small">Desde <input class="input" type="time" id="bStart" value="18:00"></label><label class="grow muted small">Hasta <input class="input" type="time" id="bEnd" value="19:30"></label></div>
    <button class="btn" data-act="dayAdd">Agregar al horario</button>
  </section>`;
}

export function render() {
  const date = addDays(new Date(), offset);
  const { current, next } = nowAndNext();
  const hasTraining = state.schedule.some(b => b.kind === 'entreno');
  const status = current ? `Ahora: ${esc(current.title)} (termina en ${fmtDuration((current.endAt - Date.now()) / 60000)})`
    : next ? `Lo siguiente: ${esc(next.title)} en ${fmtDuration((next.startAt - Date.now()) / 60000)}` : 'Sin bloques próximos';
  return `<header class="top sticky"><h1>Día</h1><div class="row">
      <button class="icon-btn" data-act="dayRefresh" aria-label="Actualizar calendario" ${refreshing ? 'disabled' : ''}>${refreshing ? '…' : '↻'}</button>
      <button class="btn ghost small" data-act="dayEdit">${editing ? 'Listo' : 'Editar horario'}</button></div></header>
    ${editing ? editor() : `
    <div class="row between day-nav">
      <button class="icon-btn" data-act="dayShift" data-d="-1" aria-label="Día anterior">‹</button>
      <b>${offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : ''} ${fmtDateLong(date)}</b>
      <button class="icon-btn" data-act="dayShift" data-d="1" aria-label="Día siguiente">›</button>
    </div>
    <div class="row wrap quick day-links">
      <button class="btn ghost small" data-act="go" data-to="rutinas">🔄 Rutinas</button>
      <button class="btn ghost small" data-act="go" data-to="habitos">🔁 Hábitos</button>
      <button class="btn ghost small" data-act="go" data-to="estudios">📚 Estudios</button>
      <button class="btn ghost small" data-act="go" data-to="revision">🧭 Revisión</button>
    </div>
    ${offset === 0 ? `<div class="pill">${status}</div>` : ''}
    ${hasTraining ? '' : `<section class="card compact" data-act="dayEdit">🏋️ Agrega tus entrenamientos al horario para que Turbo planifique alrededor de ellos →</section>`}
    ${dueList(date)}
    ${timeline(date)}`}`;
}

export function mount() {
  if (offset !== 0 || editing) return;
  const line = document.querySelector('.now-line');
  if (window.scrollY === 0) line?.scrollIntoView({ block: 'center' });
  const id = setInterval(rerender, 60000);
  return () => clearInterval(id);
}

export const actions = {
  dayShift: el => {
    offset = Math.max(-7, Math.min(MAX_AHEAD, offset + Number(el.dataset.d)));
    rerender();
  },
  dayRefresh: async () => {
    if (refreshing) return;
    refreshing = true;
    rerender();
    const r = await refreshExternal(true);
    refreshing = false;
    toast(!r ? 'Conecta tu calendario en Ajustes' : r.ok ? 'Calendario al día' : `No pude actualizar: ${r.error}`);
    rerender();
  },
  dayEdit: () => {
    editing = !editing;
    rerender();
  },
  dayDel: el => {
    update(s => {
      const b = s.schedule.find(x => x.id === el.dataset.id);
      s.schedule = s.schedule.filter(x => x.id !== el.dataset.id);
      if (b?.date) s.calBorrados = [...(s.calBorrados || []), b.id].slice(-100); // el puente lo borra también en Google
    });
  },
  dayAdd: () => {
    const title = document.getElementById('bTitle').value.trim();
    const kind = document.getElementById('bKind').value;
    const date = document.getElementById('bDate').value || null;
    const days = date ? [] : [...document.querySelectorAll('.bDay:checked')].map(i => Number(i.value));
    const start = document.getElementById('bStart').value;
    const end = document.getElementById('bEnd').value;
    if (!title || (!days.length && !date) || !start || !end) return toast('Falta nombre, días (o fecha) u horas');
    if (hmToMin(end) <= hmToMin(start)) return toast('La hora de término debe ser después del inicio');
    update(s => { s.schedule.push({ id: uid(), title, kind, days, date, start, end }); });
    toast('Bloque agregado');
  },
};
