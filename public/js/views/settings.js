// Ajustes: conexión al servidor, notificaciones, horarios de avisos y respaldo.
import { state, update, replaceState, resetState } from '../store.js';
import { esc, dayKey } from '../util.js';
import { toast } from '../ui.js';
import { ping, enablePush, testPush, pushSupport, pullBackup, scheduleBackup, scheduleReminderSync, hasServer } from '../api.js';
import { rerender } from '../router.js';

export function render() {
  const s = state.settings;
  const sup = pushSupport();
  return `<header class="top"><h1>Ajustes</h1></header>

    <section class="card">
      <h3>🔌 Servidor</h3>
      <p class="muted small">Activa la IA, el respaldo y las notificaciones. Es la clave secreta (APP_SECRET) que pusiste en Cloudflare.</p>
      <input class="input" type="password" id="secret" value="${esc(s.secret)}" placeholder="Clave secreta" autocomplete="off">
      <div class="row"><button class="btn" data-act="setSecret">Guardar y probar</button></div>
      <p class="small">${hasServer() ? '🟢 Clave guardada' : '⚪ Sin conectar: la app funciona igual, pero sin IA ni notificaciones'}</p>
    </section>

    <section class="card">
      <h3>🔔 Notificaciones</h3>
      ${sup.ok ? '' : `<p class="small warn-text">${esc(sup.why)}</p>`}
      <p class="small">${s.notif ? '🟢 Activadas' : '⚪ Desactivadas'}</p>
      <div class="row"><button class="btn" data-act="setPush">${s.notif ? 'Reconectar' : 'Activar'}</button>${s.notif ? '<button class="btn ghost" data-act="setTestPush">Probar</button>' : ''}</div>
      <label class="muted small">Avisarme antes de cada bloque del horario (min)
        <input class="input" type="number" min="0" max="120" step="5" value="${s.remindBefore}" data-change="setField" data-f="remindBefore"></label>
      <label class="muted small">Buenos días a las <input class="input" type="time" value="${s.morningAt}" data-change="setField" data-f="morningAt"></label>
      <label class="muted small">Revisar hábitos a las <input class="input" type="time" value="${s.habitsAt}" data-change="setField" data-f="habitsAt"></label>
    </section>

    <section class="card">
      <h3>💾 Respaldo</h3>
      <p class="muted small">${hasServer() ? 'Tus datos se respaldan solos en tu servidor.' : 'Sin servidor, tus datos viven solo en este teléfono. Descarga un respaldo de vez en cuando.'}</p>
      <div class="row wrap">
        <button class="btn ghost" data-act="setExport">Descargar respaldo</button>
        <label class="btn ghost">Restaurar<input type="file" accept="application/json" data-change="setImport" hidden></label>
        ${hasServer() ? '<button class="btn ghost" data-act="setPull">Traer del servidor</button>' : ''}
      </div>
    </section>

    <section class="card">
      <h3>ℹ️ Turbo</h3>
      <p class="muted small">Versión 1.0 · Fase 1. Hecha a tu medida.</p>
      <button class="btn danger ghost small" data-act="setReset">Borrar todo y empezar de cero</button>
    </section>`;
}

export const actions = {
  setSecret: async () => {
    const v = document.getElementById('secret').value.trim();
    update(s => { s.settings.secret = v; });
    if (!v) return toast('Clave borrada');
    try {
      const r = await ping();
      toast(r.ai ? '🟢 Conectado, con IA' : '🟢 Conectado (falta la clave de Gemini en el servidor)');
      await pullBackup();
      scheduleBackup();
    } catch (e) {
      toast(`No se pudo conectar: ${e.message}`);
    }
    rerender();
  },
  setPush: async () => {
    try {
      await enablePush();
      toast('🔔 Notificaciones activadas');
    } catch (e) {
      toast(e.message);
    }
    rerender();
  },
  setTestPush: async () => {
    try {
      await testPush();
      toast('Enviada. Debería llegar en unos segundos.');
    } catch (e) {
      toast(`Falló: ${e.message}`);
    }
  },
  setField: el => {
    const f = el.dataset.f;
    update(s => { s.settings[f] = f === 'remindBefore' ? Number(el.value) || 0 : el.value; });
    scheduleReminderSync();
  },
  setExport: () => {
    const blob = new Blob([JSON.stringify({ ...state, settings: { ...state.settings, secret: '' } }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `turbo-respaldo-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  setImport: async el => {
    const file = el.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.tasks || !data.game) throw new Error('formato');
      if (!confirm('Esto reemplaza tus datos actuales por los del respaldo. ¿Seguir?')) return;
      replaceState({ ...data, settings: { ...data.settings, secret: state.settings.secret } });
      toast('Respaldo restaurado');
    } catch {
      toast('Ese archivo no es un respaldo de Turbo');
    }
  },
  setPull: async () => {
    toast((await pullBackup()) ? 'Datos actualizados desde el servidor' : 'Ya tienes la versión más nueva');
  },
  setReset: () => {
    if (!confirm('¿Borrar TODO (tareas, hábitos, XP, autos)? No se puede deshacer.')) return;
    if (!confirm('¿Seguro seguro?')) return;
    resetState();
    toast('Listo, empezamos de cero');
  },
};
