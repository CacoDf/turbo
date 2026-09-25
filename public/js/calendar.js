// Calendario en ambas direcciones:
// - Turbo → tu calendario: un link .ics al que se suscribe el iPhone o Google Calendar.
// - Tu calendario → Turbo: la "dirección secreta iCal" de Google Calendar; el servidor la lee.
import { state, update } from './store.js';
import { toast } from './ui.js';
import { hasServer, calendarEnable, calendarImportSet, calendarImportGet, scheduleReminderSync } from './api.js';

const feedPath = () => `/api/calendar/${state.calendar.token}.ics`;
const httpsLink = () => `${location.origin}${feedPath()}`;
const webcalLink = () => `webcal://${location.host}${feedPath()}`;

// Trae los eventos del calendario externo (como máximo cada 20 min, o si se fuerza).
export async function refreshExternal(force = false) {
  if (!hasServer() || !state.calendar.importOn) return;
  if (!force && Date.now() - state.calendar.lastImport < 20 * 60000) return;
  try {
    const { events, connected } = await calendarImportGet();
    update(s => {
      s.extEvents = connected ? events : [];
      s.calendar.lastImport = Date.now();
      if (!connected) s.calendar.importOn = false;
    });
    scheduleReminderSync();
  } catch (e) {
    console.warn('Calendario externo', e);
  }
}

export function calendarCard() {
  if (!hasServer()) return '';
  const c = state.calendar;
  return `<section class="card">
    <h3>📅 Calendario</h3>
    <div class="label">TURBO EN TU CALENDARIO</div>
    ${c.token ? `<p class="muted small">Tus clases, gym, eventos, pruebas y tareas con fecha aparecen en tu calendario y se actualizan solas.</p>
      <a class="btn" href="${webcalLink()}">📱 Agregar al Calendario del iPhone</a>
      <button class="btn ghost" data-act="calCopy">Copiar link (para Google Calendar)</button>
      <details class="muted small"><summary>¿Cómo lo agrego en Google Calendar?</summary>
        <p>En el computador: <b>calendar.google.com</b> → a la izquierda, junto a "Otros calendarios", toca <b>+</b> → <b>Desde URL</b> → pega el link → <b>Agregar calendario</b>.</p></details>`
      : `<p class="muted small">Haz que tus clases, gym, pruebas y tareas aparezcan en el Calendario del iPhone o en Google Calendar.</p>
      <button class="btn" data-act="calEnable">Activar</button>`}

    <div class="label" style="margin-top:16px">TU GOOGLE CALENDAR EN TURBO</div>
    ${c.importOn ? `<p class="small">🟢 Conectado · ${state.extEvents.length} eventos en los próximos 2 meses</p>
      <div class="row"><button class="btn ghost" data-act="calRefresh">Actualizar ahora</button><button class="btn danger ghost" data-act="calImportOff">Desconectar</button></div>`
      : `<p class="muted small">Lo que anotes en Google Calendar aparece en Turbo (en Día, en los avisos y para tu secretaria).</p>
      <details class="small"><summary><b>Paso a paso para sacar el link</b></summary>
        <ol class="muted">
          <li>En el <b>computador</b>, abre <b>calendar.google.com</b>.</li>
          <li>Arriba a la derecha: ⚙️ → <b>Configuración</b>.</li>
          <li>A la izquierda, en "Configuración de mis calendarios", toca <b>tu nombre</b>.</li>
          <li>Baja hasta <b>"Integrar el calendario"</b>.</li>
          <li>Copia la <b>"Dirección secreta en formato iCal"</b> (termina en <b>.ics</b>).</li>
          <li>Pégala aquí abajo. Es privada: no la compartas con nadie más.</li>
        </ol></details>
      <input class="input" id="calUrl" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
      <button class="btn" data-act="calImport">Conectar</button>`}
  </section>`;
}

export const actions = {
  calEnable: async () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
    try {
      await calendarEnable(token);
      update(s => { s.calendar.token = token; });
      toast('Listo. Ahora agrégalo a tu calendario 👇');
    } catch (e) {
      toast(`No se pudo: ${e.message}`);
    }
  },
  calCopy: async () => {
    try {
      await navigator.clipboard.writeText(httpsLink());
      toast('Link copiado');
    } catch {
      prompt('Copia este link:', httpsLink());
    }
  },
  calImport: async el => {
    const url = document.getElementById('calUrl').value.trim();
    if (!url) return toast('Pega el link del calendario');
    el.disabled = true;
    el.textContent = 'Conectando…';
    try {
      const { events } = await calendarImportSet(url);
      update(s => {
        s.calendar.importOn = true;
        s.calendar.lastImport = Date.now();
        s.extEvents = events;
      });
      scheduleReminderSync();
      toast(`🟢 Conectado: ${events.length} eventos encontrados`);
    } catch (e) {
      toast(e.message);
      el.disabled = false;
      el.textContent = 'Conectar';
    }
  },
  calRefresh: async () => {
    await refreshExternal(true);
    toast(`${state.extEvents.length} eventos`);
  },
  calImportOff: async () => {
    if (!confirm('¿Desconectar Google Calendar de Turbo?')) return;
    try {
      await calendarImportSet('');
    } catch {}
    update(s => { s.calendar.importOn = false; s.extEvents = []; });
    scheduleReminderSync();
  },
};

