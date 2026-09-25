// Operaciones sobre tareas y foco que usan varias pantallas.
import { state, update } from './store.js';
import { award, XP, levelInfo } from './game.js';
import { fallbackSteps } from './planner.js';
import { hasServer, aiSteps, scheduleReminderSync } from './api.js';
import { uid, dayKey } from './util.js';
import { toast, celebrate } from './ui.js';
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

export function addTasks(items) {
  update(s => {
    for (const it of items) {
      s.tasks.push({
        id: uid(),
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
  scheduleReminderSync();
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
  scheduleReminderSync();
}

export function deleteTask(id) {
  update(s => {
    s.tasks = s.tasks.filter(t => t.id !== id);
    if (s.currentTaskId === id) s.currentTaskId = null;
  });
  scheduleReminderSync();
}

export function startFocus(taskId, minutes, label = null) {
  update(s => {
    s.focus = { taskId, label, start: Date.now(), endAt: Date.now() + minutes * 60000, plannedMin: minutes, xpTicks: 0 };
    if (taskId) s.currentTaskId = taskId;
  });
  reward(XP.focusStart, 'focus', 'Arrancaste 🚦');
  scheduleReminderSync();
  go('foco');
}

// Cierra la sesión y suma el tiempo real trabajado a la tarea (para comparar con lo estimado).
export function endFocus() {
  const f = state.focus;
  if (!f) return 0;
  const worked = Math.min(Date.now(), f.endAt) - f.start;
  update(s => {
    const t = s.tasks.find(y => y.id === f.taskId);
    if (t) t.focusMs = (t.focusMs || 0) + worked;
    s.focus = null;
  });
  scheduleReminderSync();
  return worked;
}

export function extendFocus(minutes) {
  update(s => {
    if (!s.focus) return;
    const base = Math.max(Date.now(), s.focus.endAt);
    s.focus.endAt = base + minutes * 60000;
    s.focus.plannedMin += minutes;
  });
  scheduleReminderSync();
}
