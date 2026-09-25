// Revisión semanal (domingo, 5 min): números de la semana, 2 preguntas, resumen con IA
// y 3 prioridades para la semana que viene. Luego planifica las metas.
import { state, update } from '../store.js';
import { XP, lastDays } from '../game.js';
import { esc, dayKey, addDays, fmtDuration } from '../util.js';
import { toast, celebrate } from '../ui.js';
import { hasServer, aiReview } from '../api.js';
import { reward } from '../actions.js';
import { mondayKey, planGoalWeek } from './goals.js';
import { rerender, go } from '../router.js';

let step = 'stats'; // stats → ask → result
let answers = { good: '', hard: '' };
let result = null;
let picks = [];

// Números de los últimos 7 días (sin plata ni Escudo, que no se mandan a la IA).
export function weekStats() {
  const days = lastDays(7);
  const inWeek = e => days.includes(e.day);
  const log = state.game.log.filter(inWeek);
  const done = state.tasks.filter(t => t.done && days.includes(dayKey(new Date(t.doneAt))));
  const habits = state.habits.filter(h => !h.archived);
  let met = 0;
  days.forEach(d => habits.forEach(h => { if ((state.habitLog[d]?.[h.id] || 0) >= h.target) met++; }));
  const moods = state.mood.filter(m => days.includes(m.day));
  const avg = k => (moods.length ? +(moods.reduce((a, m) => a + m[k], 0) / moods.length).toFixed(1) : null);
  return {
    tareas_hechas: done.length,
    titulos_hechos: done.slice(0, 15).map(t => t.title),
    atrasadas: state.tasks.filter(t => !t.done && t.due && t.due < dayKey()).map(t => t.title).slice(0, 10),
    minutos_foco: log.filter(e => e.type === 'focus' && e.text.startsWith('5 minutos')).length * 5,
    sesiones_foco: log.filter(e => e.type === 'focus' && e.text.startsWith('Arrancaste')).length,
    habitos_pct: habits.length ? Math.round((met / (habits.length * 7)) * 100) : null,
    rutinas: days.reduce((a, d) => a + Object.keys(state.routineLog[d] || {}).length, 0),
    dias_activos: days.filter(d => log.some(e => e.day === d)).length,
    energia_promedio: avg('energy'),
    animo_promedio: avg('mood'),
    xp: log.reduce((a, e) => a + e.xp, 0),
    metas: state.goals.filter(g => !g.done).map(g => ({ meta: g.title, pasos_semana: state.tasks.filter(t => t.goalId === g.id && t.done && days.includes(dayKey(new Date(t.doneAt)))).length })),
    evaluaciones_proximas: state.exams.filter(e => !e.done && e.date >= dayKey() && e.date <= dayKey(addDays(new Date(), 14))).map(e => `${e.title} (${e.date})`),
  };
}

function fallback(s) {
  const highlights = [];
  if (s.tareas_hechas) highlights.push(`Terminaste ${s.tareas_hechas} ${s.tareas_hechas === 1 ? 'tarea' : 'tareas'}`);
  if (s.minutos_foco) highlights.push(`${fmtDuration(s.minutos_foco)} de foco`);
  if (s.rutinas) highlights.push(`${s.rutinas} rutinas completas`);
  if (s.habitos_pct) highlights.push(`Cumpliste el ${s.habitos_pct}% de tus hábitos`);
  if (highlights.length < 2 && s.xp) highlights.push(`Ganaste ${s.xp} XP en ${s.dias_activos} ${s.dias_activos === 1 ? 'día' : 'días'} activos`);
  if (!highlights.length) highlights.push('Abriste Turbo y estás revisando tu semana: eso ya cuenta');
  const priorities = [...s.evaluaciones_proximas.map(e => `Preparar ${e}`), ...s.atrasadas.map(t => `Cerrar: ${t}`), ...s.metas.map(m => `Avanzar en ${m.meta}`)].slice(0, 3);
  while (priorities.length < 3) priorities.push(['Hacer al menos 1 sesión de foco al día', 'Completar tus hábitos 5 de 7 días', 'Usar la secretaria cada mañana'][priorities.length]);
  return { highlights, insight: s.dias_activos >= 5 ? 'Estuviste activo casi todos los días: la constancia te está funcionando.' : 'Hubo días sin actividad. Probemos con algo mínimo diario: solo 5 minutos.', priorities, message: '¡Vamos por otra semana! 🏎️' };
}

function statsView() {
  const s = weekStats();
  const tile = (n, l) => `<section class="card compact center"><div class="big-num">${n ?? '–'}</div><div class="muted tiny">${l}</div></section>`;
  return `<header class="top"><h1>🧭 Revisión semanal</h1></header>
    <p class="muted">5 minutos para mirar tu semana (últimos 7 días) y elegir en qué enfocarte.</p>
    <div class="hub">
      ${tile(s.tareas_hechas, 'tareas terminadas')}${tile(fmtDuration(s.minutos_foco), 'de foco')}
      ${tile(s.habitos_pct != null ? s.habitos_pct + '%' : null, 'hábitos cumplidos')}${tile(`${s.dias_activos}/7`, 'días activos')}
      ${tile(s.rutinas, 'rutinas')}${tile(s.energia_promedio, 'energía promedio')}
    </div>
    ${s.atrasadas.length ? `<section class="card"><div class="label">QUEDARON PENDIENTES</div>${s.atrasadas.map(t => `<div class="muted small">• ${esc(t)}</div>`).join('')}</section>` : ''}
    <button class="btn huge" data-act="rvNext">Seguir →</button>`;
}

function askView() {
  return `<header class="top"><h1>🧭 Dos preguntas</h1></header>
    <p class="muted">Respóndelas como quieras, puedes dictar. O déjalas en blanco.</p>
    <section class="card">
      <h3>¿Qué salió bien esta semana?</h3>
      <textarea class="input" id="rvGood" rows="3" placeholder="ej: fui 4 veces al gym, estudié antes de la prueba…">${esc(answers.good)}</textarea>
      <h3>¿Qué te costó?</h3>
      <textarea class="input" id="rvHard" rows="3" placeholder="ej: me dormí tarde, perdí mucho rato en reels…">${esc(answers.hard)}</textarea>
    </section>
    <button class="btn huge" data-act="rvGenerate">✨ Ver mi revisión</button>`;
}

function resultView() {
  const r = result;
  return `<header class="top"><h1>🧭 Tu semana</h1></header>
    <section class="card"><div class="label">LO QUE LOGRASTE</div>${r.highlights.map(h => `<div class="win">✅ ${esc(h)}</div>`).join('')}</section>
    <section class="card"><div class="label">LO QUE APRENDISTE DE TI</div><p>${esc(r.insight)}</p></section>
    <section class="card"><div class="label">TUS 3 PRIORIDADES PARA LA SEMANA</div>
      ${picks.map((p, i) => `<input class="input" value="${esc(p)}" data-change="rvPick" data-i="${i}">`).join('')}
      <p class="muted tiny">Edítalas si quieres. Las verás en la pantalla Ahora toda la semana.</p>
    </section>
    <p class="center"><b>${esc(r.message)}</b></p>
    <button class="btn huge" data-act="rvSave">Guardar y planificar la semana</button>`;
}

export function render() {
  if (step === 'ask') return askView();
  if (step === 'result' && result) return resultView();
  return statsView();
}

export const actions = {
  rvNext: () => {
    step = 'ask';
    rerender();
  },
  rvGenerate: async el => {
    answers = { good: document.getElementById('rvGood').value.trim(), hard: document.getElementById('rvHard').value.trim() };
    el.disabled = true;
    el.textContent = 'Pensando…';
    const s = weekStats();
    result = null;
    if (hasServer()) {
      try {
        result = await aiReview({ stats: s, answers });
      } catch (e) {
        console.warn(e);
      }
    }
    if (!result?.priorities?.length) result = fallback(s);
    picks = [...result.priorities];
    while (picks.length < 3) picks.push('');
    step = 'result';
    rerender();
  },
  rvPick: el => {
    picks[Number(el.dataset.i)] = el.value;
  },
  rvSave: async () => {
    const week = new Date().getDay() === 0 ? dayKey(addDays(new Date(), 1)) : mondayKey();
    update(s => {
      s.weekFocus = { week, items: picks.map(p => p.trim()).filter(Boolean).map(text => ({ text, done: false })) };
      s.reviews.unshift({ week, t: Date.now(), ai: result, answers });
      if (s.reviews.length > 30) s.reviews.length = 30;
    });
    reward(XP.review, 'review', 'Revisión semanal');
    let planned = 0;
    for (const g of state.goals.filter(x => !x.done && x.weekPlanned !== mondayKey())) planned += (await planGoalWeek(g.id, { quiet: true })) || 0;
    celebrate(planned ? `🧭 ¡Semana lista! ${planned} pasos de tus metas agregados` : '🧭 ¡Semana lista!');
    step = 'stats';
    result = null;
    answers = { good: '', hard: '' };
    go('ahora');
  },
};

// Tarjeta para Ahora con las prioridades de la semana (tocar para marcar).
export function weekFocusCard() {
  const wf = state.weekFocus;
  if (!wf?.items?.length || wf.week > dayKey(addDays(new Date(), 1)) || wf.week < dayKey(addDays(new Date(), -7))) return '';
  return `<section class="card compact">
    <div class="label">🎯 PRIORIDADES DE LA SEMANA</div>
    ${wf.items.map((it, i) => `<button class="step slim" data-act="rvFocusToggle" data-i="${i}"><span class="check ${it.done ? 'on' : ''}"></span><span class="${it.done ? 'muted strike' : ''}">${esc(it.text)}</span></button>`).join('')}
  </section>`;
}

actions.rvFocusToggle = el => {
  const i = Number(el.dataset.i);
  const was = state.weekFocus.items[i].done;
  update(s => { s.weekFocus.items[i].done = !was; });
  if (!was) toast('¡Una prioridad menos! 💪');
};
