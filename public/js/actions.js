// Operaciones sobre tareas y foco que usan varias pantallas.
import { state, update } from './store.js';
import { award, XP, levelInfo } from './game.js';
import { fallbackSteps } from './planner.js';
import { hasServer, aiSteps } from './api.js';
import { uid, dayKey, validDate, validHm, defaultEnd } from './util.js';
import { toast, celebrate, unlockAudio, dormirAudio } from './ui.js';
import { go } from './router.js';

export function reward(xp, type, text) {
  const r = award(xp, type, text);
  if (r.levelUp) {
    celebrate(`¡Nivel ${r.levelUp}! Desbloqueaste: ${levelInfo().car.name} 🏎️`);
  } else {
    toast(`+${xp} XP · ${text}`);
  }
  return r;
}

// Los ids que vienen de afuera (bandeja del Atajo) se conservan; si ya existe, no se repite.
export function addTasks(items) {
  update(s => {
    for (const it of items) {
      if (it.id && s.tasks.some(t => t.id === it.id)) continue;
      s.tasks.push({
        id: it.id || uid(),
        title: it.title,
        area: it.area || 'personal',
        minutes: Number(it.minutes) || 25,
        due: it.due || null,
        today: it.due === dayKey(),
        steps: [],
        done: false,
        createdAt: Date.now(),
        focusMs: 0,
        skips: 0,
      });
    }
  });
}

// Eventos con hora: viven en el horario como los de una sola vez (src 'turbo' = nacieron aquí).
export function addEvents(items) {
  const ok = [];
  update(s => {
    for (const it of items) {
      const date = validDate(it.date);
      const start = validHm(it.start);
      if (!date || !start || (it.id && s.schedule.some(b => b.id === it.id))) continue;
      let end = validHm(it.end);
      if (!end || end <= start) end = defaultEnd(start);
      const ev = { id: it.id || uid(), title: it.title, kind: 'otro', days: [], date, start, end, src: 'turbo' };
      s.schedule.push(ev);
      ok.push(ev);
    }
  });
  return ok;
}

export const findTask = id => state.tasks.find(t => t.id === id);

export async function breakdown(id) {
  const t = findTask(id);
  if (!t) return;
  let steps = null;
  if (hasServer()) {
    toast('Pidiéndole pasos a la IA…');
    try {
      steps = (await aiSteps(t)).map(s => ({ id: uid(), text: s.text, min: s.min, done: false }));
    } catch (e) {
      console.warn(e);
      toast('La IA no respondió; te dejo pasos base.');
    }
  }
  if (!steps?.length) steps = fallbackSteps(t);
  update(s => {
    const x = s.tasks.find(y => y.id === id);
    if (x) x.steps = steps;
  });
}

export function toggleStep(taskId, stepId) {
  const t = findTask(taskId);
  const st = t?.steps.find(s => s.id === stepId);
  if (!st) return;
  const nowDone = !st.done;
  update(s => {
    s.tasks.find(y => y.id === taskId).steps.find(y => y.id === stepId).done = nowDone;
  });
  if (nowDone) reward(XP.step, 'step', `Paso: ${st.text}`);
}

export function completeTask(id) {
  const t = findTask(id);
  if (!t || t.done) return;
  update(s => {
    const x = s.tasks.find(y => y.id === id);
    x.done = true;
    x.doneAt = Date.now();
    if (s.currentTaskId === id) s.currentTaskId = null;
  });
  const xp = XP.taskBase + Math.min(40, Math.round((t.minutes || 25) / 5));
  reward(xp, 'task', `Terminaste: ${t.title}`);
}

export function deleteTask(id) {
  update(s => {
    s.tasks = s.tasks.filter(t => t.id !== id);
    if (s.currentTaskId === id) s.currentTaskId = null;
  });
}

// Minutos de foco y de descanso que eligió en Foco (con valores de fábrica si faltan o vienen mal).
const minutos = (v, min, max, base) => (Number.isInteger(Number(v)) && v >= min && v <= max ? Number(v) : base);
export const focoMin = () => minutos(state.settings.focoMin, 5, 180, 25);
export const descansoMin = () => minutos(state.settings.descansoMin, 1, 60, 5);

export function startFocus(taskId, minutes, label = null, extra = {}) {
  unlockAudio(); // siempre parte con un toque: iOS deja sonar la alarma del final
  update(s => {
    s.focus = { taskId, label, start: Date.now(), endAt: Date.now() + minutes * 60000, plannedMin: minutes, xpTicks: 0, ...extra };
    if (taskId) s.currentTaskId = taskId;
  });
  if (!extra.descanso) reward(XP.focusStart, 'focus', 'Arrancaste 🚦'); // descansar no da puntos
  go('foco');
}

// Cierra la sesión y suma el tiempo real trabajado a la tarea (para comparar con lo estimado).
// XP de foco: +5 por cada 5 minutos reales. Si iOS congeló la app (pantalla bloqueada u otra pestaña),
// al volver se ponen al día todos juntos, cada uno en el registro (de ahí cuenta la revisión semanal).
export function focusXp() {
  const f = state.focus;
  if (!f || f.descanso) return;
  const ticks = Math.floor((Math.min(Date.now(), f.endAt) - f.start) / 300000);
  const n = ticks - (f.xpTicks || 0);
  if (n <= 0) return;
  update(s => { s.focus.xpTicks = ticks; }, { silent: true });
  let levelUp = null;
  for (let i = 0; i < n; i++) levelUp = award(XP.focusPer5, 'focus', '5 minutos de foco').levelUp || levelUp;
  if (levelUp) celebrate(`¡Nivel ${levelUp}! Desbloqueaste: ${levelInfo().car.name} 🏎️`);
  else toast(`+${n * XP.focusPer5} XP · ${n * 5} minutos de foco`);
}

export function endFocus() {
  const f = state.focus;
  if (!f) return 0;
  focusXp(); // lo que faltaba sumar si la app estuvo congelada hasta el final
  const worked = Math.min(Date.now(), f.endAt) - f.start;
  dormirAudio();
  update(s => {
    const t = s.tasks.find(y => y.id === f.taskId);
    if (t) t.focusMs = (t.focusMs || 0) + worked;
    s.focus = null;
  });
  return worked;
}

export function extendFocus(minutes) {
  unlockAudio(); // "+5" o "Sigo 15 min" también son un toque: el audio queda listo para el nuevo final
  update(s => {
    if (!s.focus) return;
    const base = Math.max(Date.now(), s.focus.endAt);
    s.focus.endAt = base + minutes * 60000;
    s.focus.plannedMin += minutes;
  });
}
