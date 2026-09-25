// Comunicación con el servidor (Cloudflare Worker): IA, respaldo y notificaciones.
// Todo es opcional: si no hay servidor configurado, la app funciona igual en el teléfono.
import { state, replaceState, update } from './store.js';
import { computeReminders } from './planner.js';

export const hasServer = () => !!state.settings.secret;

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.settings.secret}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.trim());
  return res.json();
}

export async function ping() {
  return call('ping');
}

// ---- IA ----

export async function aiCapture(text) {
  const { tasks } = await call('ai/capture', { method: 'POST', body: { text, today: new Date().toString() } });
  return tasks;
}

export async function aiSteps(task) {
  const { steps } = await call('ai/steps', { method: 'POST', body: { title: task.title, area: task.area, minutes: task.minutes } });
  return steps;
}

export async function aiStudyPlan(info) {
  const { sessions } = await call('ai/studyplan', { method: 'POST', body: info });
  return sessions;
}

export const aiAssistant = (messages, context) => call('ai/assistant', { method: 'POST', body: { messages, context } });
export const aiGoalWeek = body => call('ai/goalweek', { method: 'POST', body }).then(r => r.tasks);
export const aiReview = body => call('ai/review', { method: 'POST', body });

// ---- Calendario ----

export const calendarEnable = token => call('calendar/enable', { method: 'POST', body: { token } });
export const calendarImportSet = url => call('calendar/import-url', { method: 'PUT', body: { url } });
export const calendarImportGet = () => call('calendar/import');

// ---- Modo pareja ----

export const shareEnable = token => call('share/enable', { method: 'POST', body: { token } });
export const shareDisable = () => call('share/disable', { method: 'POST' });
export const sharePut = summary => call('share/summary', { method: 'PUT', body: { summary } });
export const getCheers = () => call('cheers');

// ---- Respaldo ----

let pushTimer = null;
let applyingRemote = false;
// No se sube nada hasta haber leído el servidor al menos una vez: así un teléfono
// recién instalado (vacío) nunca pisa un respaldo con datos.
let checkedRemote = false;

export function scheduleBackup() {
  if (!hasServer() || applyingRemote || !checkedRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    call('state', { method: 'PUT', body: { updatedAt: state.meta.updatedAt, state } }).catch(e => console.warn('Respaldo falló', e));
  }, 4000);
}

const isPristine = () => state.tasks.length === 0 && state.game.xp === 0;

// Al abrir: si el servidor tiene una versión más nueva (p. ej. editada desde el PC), la usa.
export async function pullBackup() {
  if (!hasServer()) return false;
  try {
    const remote = await call('state');
    checkedRemote = true;
    if (remote?.state && (remote.updatedAt > state.meta.updatedAt || isPristine())) {
      const secret = state.settings.secret;
      applyingRemote = true;
      replaceState({ ...remote.state, settings: { ...remote.state.settings, secret } });
      applyingRemote = false;
      return true;
    }
  } catch (e) {
    console.warn('No se pudo leer el respaldo', e);
  }
  return false;
}

// ---- Notificaciones ----

let remTimer = null;

export function scheduleReminderSync() {
  if (!hasServer() || !state.settings.notif) return;
  clearTimeout(remTimer);
  remTimer = setTimeout(() => {
    call('reminders', { method: 'PUT', body: { reminders: computeReminders() } }).catch(e => console.warn('Recordatorios fallaron', e));
  }, 2500);
}

const b64ToBytes = b64 => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

export function pushSupport() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, why: standalone ? 'Tu iPhone necesita iOS 16.4 o superior.' : 'Primero instala Turbo: en Safari toca Compartir → "Agregar a pantalla de inicio" y ábrela desde ese ícono.' };
  }
  return { ok: true };
}

export async function enablePush() {
  const sup = pushSupport();
  if (!sup.ok) throw new Error(sup.why);
  if (!hasServer()) throw new Error('Primero conecta el servidor (clave secreta).');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No diste permiso para notificaciones. Puedes activarlo en Ajustes del iPhone → Notificaciones → Turbo.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await call('push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await call('push/subscribe', { method: 'POST', body: sub.toJSON() });
  update(s => { s.settings.notif = true; });
  scheduleReminderSync();
}

export async function testPush() {
  return call('push/test', { method: 'POST' });
}
