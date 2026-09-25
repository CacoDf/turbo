// Secretaria: un chat donde le cuentas las cosas (escritas o dictadas) y ella las anota.
// Cada respuesta propone acciones que se guardan con un toque. Nunca ve el Escudo ni tu plata.
import { state, update } from '../store.js';
import { XP } from '../game.js';
import { esc, uid, dayKey, addDays, parseDayKey, DAY_NAMES, DAY_SHORT } from '../util.js';
import { toast } from '../ui.js';
import { hasServer, aiAssistant, scheduleReminderSync } from '../api.js';
import { AREAS, blocksFor, openTasks } from '../planner.js';
import { addTasks, completeTask, reward } from '../actions.js';
import { CATS } from './money.js';
import { setCount } from './habits.js';
import { plan as planExam } from './studies.js';
import { addGoal, planGoalWeek } from './goals.js';
import { saveCheckin } from './mood.js';
import { rerender } from '../router.js';

let sending = false;

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const fuzzy = (list, name, key = 'name') => {
  const n = norm(name);
  return list.find(x => norm(x[key]) === n) || list.find(x => norm(x[key]).includes(n) || n.includes(norm(x[key])));
};
const shortDate = k => {
  if (!k) return '';
  const d = parseDayKey(k);
  return k === dayKey() ? 'hoy' : k === dayKey(addDays(new Date(), 1)) ? 'mañana' : `${DAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

// Lo que la secretaria necesita saber para entender "el jueves", "mi prueba", "ya tomé agua"...
function context() {
  const now = new Date();
  const k = dayKey();
  const log = state.habitLog[k] || {};
  const next14 = Array.from({ length: 14 }, (_, i) => addDays(now, i));
  return {
    hoy: `${DAY_NAMES[now.getDay()]} ${k}`,
    hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    agenda_14_dias: next14.flatMap(d => blocksFor(d).map(b => `${dayKey(d)} ${b.start}-${b.end} ${b.title}`)).slice(0, 70),
    tareas_pendientes: openTasks().slice(0, 30).map(t => `${t.title}${t.due ? ` (vence ${t.due})` : ''}`),
    habitos: state.habits.filter(h => !h.archived).map(h => `${h.emoji} ${h.name} (${log[h.id] || 0}/${h.target} hoy)`),
    rutinas: state.routines.map(r => r.name),
    ramos: state.courses.map(c => c.name),
    evaluaciones: state.exams.filter(e => !e.done && e.date >= k).map(e => `${e.title} ${e.date}`),
    metas: state.goals.filter(g => !g.done).map(g => g.title),
  };
}

function describe(a) {
  switch (a.type) {
    case 'add_task': return `📋 Tarea: <b>${esc(a.title)}</b>${a.due ? ` · ${shortDate(a.due)}` : ''}${a.minutes ? ` · ~${a.minutes} min` : ''}`;
    case 'complete_task': return `✅ Marcar hecha: <b>${esc(a.title)}</b>`;
    case 'add_event': return `📅 Evento: <b>${esc(a.title)}</b> · ${a.date ? shortDate(a.date) : `cada ${(a.days || []).map(d => DAY_SHORT[d]).join(', ')}`} ${a.start || ''}${a.end ? `–${a.end}` : ''}`;
    case 'add_expense': return `💸 Gasto: <b>${clp(a.amount)}</b> · ${CATS[a.category]?.[0] || '❓'} ${esc(a.note || CATS[a.category]?.[1] || '')}`;
    case 'add_habit': return `🔁 Nuevo hábito: <b>${esc(a.emoji || '⭐')} ${esc(a.name)}</b>${a.target > 1 ? ` (${a.target} al día)` : ''}`;
    case 'log_habit': return `🔁 Hábito hecho hoy: <b>${esc(a.name)}</b>`;
    case 'add_exam': return `📚 Evaluación: <b>${esc(a.title)}</b>${a.course ? ` (${esc(a.course)})` : ''} · ${shortDate(a.date)} · se planifica el estudio`;
    case 'add_goal': return `🎯 Meta: <b>${esc(a.title)}</b> · se arman los pasos de la semana`;
    case 'mood': return `⚡ Energía ${a.energy || '?'}/5 · ánimo ${a.mood || '?'}/5`;
    default: return esc(a.type);
  }
}

// Aplica una acción al estado. Devuelve false si no se pudo (ej. hábito que no existe).
async function apply(a) {
  const validDate = x => (/^\d{4}-\d{2}-\d{2}$/.test(x || '') ? x : null);
  const validHm = x => (/^\d{1,2}:\d{2}$/.test(x || '') ? x.padStart(5, '0') : null);
  switch (a.type) {
    case 'add_task':
      if (!a.title) return false;
      addTasks([{ title: a.title, area: AREAS[a.area] ? a.area : 'personal', minutes: a.minutes || 25, due: validDate(a.due) }]);
      return true;
    case 'complete_task': {
      const t = fuzzy(openTasks(), a.title, 'title');
      if (!t) return false;
      completeTask(t.id);
      return true;
    }
    case 'add_event': {
      const start = validHm(a.start);
      if (!a.title || !start) return false;
      let end = validHm(a.end);
      if (!end || end <= start) {
        const [h, m] = start.split(':').map(Number);
        end = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const date = validDate(a.date);
      const days = (a.days || []).filter(d => d >= 0 && d <= 6);
      if (!date && !days.length) return false;
      update(s => { s.schedule.push({ id: uid(), title: a.title, kind: ['clase', 'entreno', 'pega', 'otro'].includes(a.kind) ? a.kind : 'otro', days: date ? [] : days, date, start, end }); });
      return true;
    }
    case 'add_expense':
      if (!(a.amount > 0)) return false;
      update(s => { s.money.expenses.push({ id: uid(), t: Date.now(), amount: Math.round(a.amount), cat: CATS[a.category] ? a.category : 'otro', note: a.note || '' }); });
      return true;
    case 'add_habit':
      if (!a.name) return false;
      update(s => { s.habits.push({ id: uid(), name: a.name, emoji: a.emoji || '⭐', target: Math.max(1, a.target || 1) }); });
      return true;
    case 'log_habit': {
      const h = fuzzy(state.habits.filter(x => !x.archived), a.name);
      if (!h) return false;
      setCount(h.id, h.target);
      return true;
    }
    case 'add_exam': {
      const date = validDate(a.date);
      if (!a.title || !date) return false;
      let course = a.course ? fuzzy(state.courses, a.course) : null;
      if (!course && a.course) {
        course = { id: uid(), name: a.course, color: ['#6fb3d9', '#7bd88f', '#f2b86b', '#a99cf2', '#ef8a8a'][state.courses.length % 5] };
        update(s => { s.courses.push(course); });
      }
      const id = uid();
      const kinds = ['prueba', 'control', 'examen', 'entrega', 'presentacion'];
      update(s => { s.exams.push({ id, courseId: course?.id || null, kind: kinds.includes(a.kind) ? a.kind : 'prueba', title: a.title, date, hours: Math.max(1, a.hours || 4), planned: false, done: false }); });
      await planExam(id);
      return true;
    }
    case 'add_goal': {
      if (!a.title) return false;
      const id = addGoal({ title: a.title, why: a.why || '', deadline: a.deadline });
      await planGoalWeek(id, { quiet: true });
      return true;
    }
    case 'mood':
      if (!a.energy && !a.mood) return false;
      saveCheckin(Math.min(5, Math.max(1, a.energy || 3)), Math.min(5, Math.max(1, a.mood || 3)), []);
      return true;
  }
  return false;
}

// Saludo de la entrevista de la mañana: se arma sin IA con lo que ya sabe de tu día.
function morningGreeting() {
  const today = new Date();
  const blocks = blocksFor(today).map(b => `${b.title} ${b.start}–${b.end}`);
  const exams = state.exams.filter(e => !e.done && e.date >= dayKey() && e.date <= dayKey(addDays(today, 3))).map(e => `${e.title} (${shortDate(e.date)})`);
  const due = openTasks().filter(t => t.due && t.due <= dayKey()).length;
  let text = `☀️ ¡Buenos días! Hoy es ${DAY_NAMES[today.getDay()].toLowerCase()}.`;
  text += blocks.length ? ` Tienes: ${blocks.join(', ')}.` : ' No tienes nada fijo en el horario.';
  if (exams.length) text += ` Ojo, se viene: ${exams.join(', ')}.`;
  if (due) text += ` Hay ${due} ${due === 1 ? 'cosa pendiente' : 'cosas pendientes'} para hoy o atrasadas.`;
  text += '\n\nCuéntame: ¿qué más tienes hoy? ¿Algo que te dé vueltas? ¿Cómo dormiste? Dímelo todo de corrido, yo lo ordeno 🎤';
  return text;
}

export function needsInterview() {
  const h = new Date().getHours();
  return h >= 5 && h < 14 && state.meta.lastInterview !== dayKey();
}

const SUGGESTIONS = [
  'El jueves a las 5 tengo dentista',
  'Gasté 8 lucas en almuerzo',
  'Tengo prueba de Finanzas el 30, necesito unas 4 horas',
  'Quiero conseguir pega de medio tiempo',
  'Ya tomé agua y entrené',
  '¿Qué hago ahora?',
];

function bubble(m) {
  if (m.role === 'user') return `<div class="msg me">${esc(m.text)}</div>`;
  const acts = m.actions?.length ? `<div class="acts">
    ${m.actions.map((a, i) => `<label class="act ${m.status === 'saved' ? (a.ok === false ? 'fail' : 'done') : ''}">
      ${m.status === 'pending' ? `<input type="checkbox" checked data-i="${i}" class="actChk">` : a.ok === false ? '⚠️' : '✓'}
      <span>${describe(a)}</span></label>`).join('')}
    ${m.status === 'pending' ? `<div class="row"><button class="btn small" data-act="asSave" data-id="${m.id}">✓ Guardar</button><button class="btn ghost small" data-act="asSkip" data-id="${m.id}">No, gracias</button></div>`
      : m.status === 'saved' ? '<div class="muted tiny">Guardado</div>' : '<div class="muted tiny">Descartado</div>'}
  </div>` : '';
  return `<div class="msg ai">${esc(m.text).replace(/\n/g, '<br>')}${acts}</div>`;
}

export function render() {
  const msgs = state.chat.slice(-40);
  return `<header class="top"><h1>🤖 Secretaria</h1>${msgs.length ? '<button class="btn ghost small" data-act="asClear">Limpiar</button>' : ''}</header>
    ${hasServer() ? '' : '<section class="card"><p class="warn-text small">Conecta el servidor en ⚙️ Ajustes para que la secretaria funcione.</p></section>'}
    <div class="chat" id="chat">
      ${msgs.length ? msgs.map(bubble).join('') : `<div class="msg ai">¡Hola! Soy tu secretaria 🤖 Cuéntame lo que sea, escrito o dictado con el 🎤 del teclado, y yo lo anoto: tareas, eventos, gastos, pruebas, metas, hábitos… Todo de una.</div>
        <div class="chips pick">${SUGGESTIONS.map(s => `<button class="chip" data-act="asSuggest" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
      ${sending ? '<div class="msg ai typing"><span></span><span></span><span></span></div>' : ''}
    </div>
    <div class="composer">
      <textarea id="asInput" class="input" rows="2" placeholder="Escribe o toca 🎤 para dictar…"></textarea>
      <button class="btn" data-act="asSend" ${sending ? 'disabled' : ''} aria-label="Enviar">➤</button>
    </div>`;
}

export function mount() {
  if (needsInterview()) {
    update(s => {
      s.meta.lastInterview = dayKey();
      s.chat.push({ id: uid(), role: 'ai', text: morningGreeting(), t: Date.now() });
    });
    return;
  }
  document.getElementById('chat')?.lastElementChild?.scrollIntoView({ block: 'end' });
  window.scrollTo(0, document.body.scrollHeight);
}

async function send(text) {
  text = text.trim();
  if (!text || sending) return;
  if (!hasServer()) return toast('Primero conecta el servidor en ⚙️ Ajustes');
  update(s => {
    s.chat.push({ id: uid(), role: 'user', text, t: Date.now() });
    if (s.chat.length > 80) s.chat.splice(0, s.chat.length - 80);
  });
  sending = true;
  rerender();
  try {
    const history = state.chat.slice(-12).map(m => ({ role: m.role, text: m.text }));
    const { reply, actions } = await aiAssistant(history, context());
    update(s => { s.chat.push({ id: uid(), role: 'ai', text: reply || 'Listo.', actions, status: actions.length ? 'pending' : null, t: Date.now() }); });
  } catch (e) {
    console.warn(e);
    update(s => { s.chat.push({ id: uid(), role: 'ai', text: `Uy, no pude responder (${e.message}). Intenta de nuevo en un rato.`, t: Date.now() }); });
  }
  sending = false;
  rerender();
}

export const actions = {
  asSend: () => {
    const el = document.getElementById('asInput');
    const text = el.value;
    el.value = '';
    send(text);
  },
  asSuggest: el => {
    const input = document.getElementById('asInput');
    input.value = el.dataset.t;
    input.focus();
  },
  asSave: async el => {
    const m = state.chat.find(x => x.id === el.dataset.id);
    if (!m) return;
    const checks = [...el.closest('.acts').querySelectorAll('.actChk')];
    const chosen = m.actions.map((a, i) => ({ ...a, keep: checks[i] ? checks[i].checked : true }));
    update(s => { s.chat.find(x => x.id === m.id).status = 'saving'; }, { silent: true });
    const results = [];
    for (const a of chosen) results.push(a.keep ? await apply(a).catch(() => false) : null);
    const saved = results.filter(r => r === true).length;
    update(s => {
      const x = s.chat.find(y => y.id === m.id);
      x.status = 'saved';
      x.actions = chosen.filter((_, i) => results[i] !== null).map((a, i2) => ({ ...a, ok: results.filter(r => r !== null)[i2] }));
    });
    scheduleReminderSync();
    if (saved) reward(XP.assistant, 'assistant', `Tu secretaria anotó ${saved} ${saved === 1 ? 'cosa' : 'cosas'}`);
    if (results.includes(false)) toast('Algunas cosas no se pudieron guardar (⚠️)');
  },
  asSkip: el => update(s => { s.chat.find(x => x.id === el.dataset.id).status = 'dismissed'; }),
  asClear: () => {
    if (!confirm('¿Borrar la conversación? Lo que ya guardaste se queda.')) return;
    update(s => { s.chat = []; });
  },
};
