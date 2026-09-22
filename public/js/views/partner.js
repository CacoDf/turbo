// Modo pareja: un link de solo lectura con tu resumen semanal y la opción de mandarte ánimo.
// Nunca incluye Escudo, plata ni ánimo; los nombres de tareas solo si tú lo activas.
import { state, update } from '../store.js';
import { levelInfo, habitStreak } from '../game.js';
import { esc, addDays, dayKey } from '../util.js';
import { toast } from '../ui.js';
import { hasServer, shareEnable, shareDisable, sharePut, getCheers } from '../api.js';
import { rerender } from '../router.js';

const SHARED_TYPES = ['task', 'step', 'focus', 'habit', 'capture', 'routine', 'study'];

function weekDays() {
  const d = new Date();
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(monday, i)));
}

export function buildSummary() {
  const days = weekDays();
  const today = dayKey();
  const log = state.game.log.filter(e => days.includes(e.day) && SHARED_TYPES.includes(e.type));
  const tasksDone = state.tasks.filter(t => t.done && days.includes(dayKey(new Date(t.doneAt))));
  const habits = state.habits.filter(h => !h.archived);
  const pastDays = days.filter(d => d <= today);
  let met = 0;
  pastDays.forEach(d => habits.forEach(h => { if ((state.habitLog[d]?.[h.id] || 0) >= h.target) met++; }));
  const lv = levelInfo();
  return {
    updated: Date.now(),
    level: lv.lvl,
    car: lv.car.name,
    carColor: lv.car.color,
    streak: state.game.streak.current,
    xpWeek: log.reduce((a, e) => a + e.xp, 0),
    tasksDone: tasksDone.length,
    focusMin: log.filter(e => e.type === 'focus' && e.text.startsWith('5 minutos')).length * 5,
    habitsPct: habits.length && pastDays.length ? Math.round((met / (habits.length * pastDays.length)) * 100) : 0,
    habitStreaks: habits.map(h => ({ name: `${h.emoji} ${h.name}`, streak: habitStreak(h) })),
    routines: Object.entries(state.routineLog).filter(([d]) => days.includes(d)).reduce((a, [, r]) => a + Object.keys(r).length, 0),
    activeDays: days.map(d => ({ d, active: state.game.log.some(e => e.day === d && SHARED_TYPES.includes(e.type)) })),
    wins: state.partner.showTitles ? tasksDone.slice(-8).map(t => t.title) : [],
  };
}

let timer = null;
export function schedulePartnerSync() {
  if (!state.partner.enabled || !hasServer()) return;
  clearTimeout(timer);
  timer = setTimeout(() => sharePut(buildSummary()).catch(e => console.warn('Resumen pareja', e)), 8000);
}

export async function refreshCheers() {
  if (!state.partner.enabled || !hasServer()) return;
  try {
    const { cheers } = await getCheers();
    if (JSON.stringify(cheers) !== JSON.stringify(state.partner.cheers)) update(s => { s.partner.cheers = cheers; });
  } catch (e) {
    console.warn(e);
  }
}

export function unseenCheer() {
  const c = state.partner.cheers;
  return c.length > state.partner.seenCheers ? c[0] : null;
}

const link = () => `${location.origin}/pareja.html#${state.partner.token}`;

export function render() {
  const p = state.partner;
  if (!hasServer()) {
    return `<header class="top"><h1>💑 Pareja</h1></header><section class="card"><p>Para compartir tu avance primero conecta el servidor en ⚙️ Ajustes.</p></section>`;
  }
  if (!p.enabled) {
    return `<header class="top"><h1>💑 Pareja</h1></header>
      <section class="card">
        <p>Comparte un link con tu polola (o quien quieras) para que vea tu <b>avance de la semana</b> y te pueda mandar ánimo 💌, que te llega como notificación.</p>
        <p class="muted small"><b>Lo que ve:</b> nivel y auto, racha, tareas terminadas, minutos de foco, % de hábitos y rutinas.<br>
        <b>Lo que NUNCA ve:</b> el Escudo, tu plata, tu ánimo ni tus tareas pendientes.</p>
        <button class="btn" data-act="ptEnable">Crear link</button>
      </section>`;
  }
  const s = buildSummary();
  return `<header class="top"><h1>💑 Pareja</h1></header>
    <section class="card">
      <div class="label">TU LINK</div>
      <div class="link-box">${esc(link())}</div>
      <div class="row"><button class="btn" data-act="ptShare">Compartir link</button><button class="btn ghost" data-act="ptCopy">Copiar</button></div>
      <label class="toggle"><input type="checkbox" ${p.showTitles ? 'checked' : ''} data-change="ptTitles"> Mostrar los nombres de las tareas que termino</label>
    </section>
    <section class="card">
      <div class="label">LO QUE VE AHORA</div>
      <div class="row between"><span>Tareas esta semana</span><b>${s.tasksDone}</b></div>
      <div class="row between"><span>Minutos de foco</span><b>${s.focusMin}</b></div>
      <div class="row between"><span>Hábitos cumplidos</span><b>${s.habitsPct}%</b></div>
      <div class="row between"><span>Racha</span><b>🔥 ${s.streak}</b></div>
    </section>
    <h3 class="group">Ánimo recibido 💌</h3>
    <section class="card">${p.cheers.length ? p.cheers.slice(0, 20).map(c => `<div class="win"><b>${esc(c.from || 'Alguien')}:</b> ${esc(c.msg)} <span class="muted tiny">${new Date(c.t).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}</span></div>`).join('') : '<p class="muted small">Todavía nada. Comparte el link 😉</p>'}</section>
    <button class="btn danger ghost" data-act="ptDisable">Desactivar link</button>`;
}

export function mount() {
  if (state.partner.enabled) {
    refreshCheers();
    if (state.partner.seenCheers !== state.partner.cheers.length) update(s => { s.partner.seenCheers = s.partner.cheers.length; }, { silent: true });
  }
}

export const actions = {
  ptEnable: async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    try {
      await shareEnable(token);
      update(s => { s.partner.enabled = true; s.partner.token = token; });
      await sharePut(buildSummary());
      toast('Link creado');
    } catch (e) {
      toast(`No se pudo: ${e.message}`);
    }
  },
  ptShare: async () => {
    try {
      await navigator.share({ title: 'Mi avance en Turbo 🏎️', text: 'Mira cómo voy esta semana y mándame ánimo:', url: link() });
    } catch {
      actions.ptCopy();
    }
  },
  ptCopy: async () => {
    try {
      await navigator.clipboard.writeText(link());
      toast('Link copiado');
    } catch {
      toast('No se pudo copiar; mantén presionado el link para copiarlo');
    }
  },
  ptTitles: el => {
    update(s => { s.partner.showTitles = el.checked; });
    sharePut(buildSummary()).catch(() => {});
  },
  ptDisable: async () => {
    if (!confirm('¿Desactivar el link? Quien lo tenga ya no podrá ver tu avance.')) return;
    try {
      await shareDisable();
    } catch {}
    update(s => { s.partner.enabled = false; s.partner.token = null; });
    rerender();
  },
};
