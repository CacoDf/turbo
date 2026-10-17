// Calendario en ambas direcciones:
// - Puente con Google (Apps Script, ver docs/GOOGLE.md): lo que anotas con hora sale en Google y todo
//   Google aparece en Turbo. Si mueves o borras allá algo de Turbo, aquí también cambia.
// - Respaldo sin puente: un link .ics para que tu calendario vea Turbo, y la "dirección secreta iCal"
//   de Google para que Turbo vea tu calendario (solo lectura, una vez por hora).
import { state, update } from './store.js';
import { toast } from './ui.js';
import { hasServer, calendarEnable, calendarImportSet, calendarImportGet, puenteSet } from './api.js';

const feedPath = () => `/api/calendar/${state.calendar.token}.ics`;
const httpsLink = () => `${location.origin}${feedPath()}`;
const webcalLink = () => `webcal://${location.host}${feedPath()}`;

// Trae los eventos del calendario externo (como máximo cada 20 min, o si se fuerza).
// Se le pregunta siempre al servidor (no a lo guardado en este aparato): él sabe si hay
// calendario conectado, aunque se haya conectado desde otro dispositivo.
export async function refreshExternal(force = false) {
  if (!hasServer()) return;
  if (!force && Date.now() - (state.calendar.lastImport || 0) < 20 * 60000) return;
  try {
    const { events, connected, error, puente, cambios } = await calendarImportGet(force);
    const extEvents = connected ? events : [];
    const c = state.calendar;
    // Si Google no trajo nada nuevo, no se redibuja: redibujar cierra el teclado y borra lo que se está escribiendo.
    const igual = !force && !cambios?.length && JSON.stringify(extEvents) === JSON.stringify(state.extEvents || [])
      && (error || null) === (c.lastError || null) && !!connected === !!c.importOn && !!puente === !!c.puenteOn;
    update(s => {
      s.extEvents = extEvents;
      s.calendar.lastImport = Date.now();
      s.calendar.lastError = error || null;
      s.calendar.importOn = !!connected;
      s.calendar.puenteOn = !!puente;
      seguirGoogle(s, cambios);
    }, { silent: igual });
    return { ok: !error, error };
  } catch (e) {
    console.warn('Calendario externo', e);
    update(s => { s.calendar.lastError = e.message || 'Sin conexión con el servidor'; }, { silent: true });
    return { ok: false, error: e.message };
  }
}

// Lo de Turbo que se movió o borró en Google: Turbo lo sigue (igual que aplicarCambios en src/puente.js).
function seguirGoogle(s, cambios = []) {
  for (const c of cambios || []) {
    const i = s.schedule.findIndex(b => b.id === c.id);
    if (i < 0) continue;
    if (c.borrar) s.schedule.splice(i, 1);
    else Object.assign(s.schedule[i], { title: c.title, date: c.date, start: c.start, end: c.end });
  }
}

const eventos = n => `${n} ${n === 1 ? 'evento' : 'eventos'}`;
const hora = t => new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
const limpio = t => String(t).replace(/[<>&]/g, '');

// Puente con Google: conectado, o el paso a paso para armarlo (una vez, en el computador).
function puenteCard() {
  const c = state.calendar;
  if (c.puenteOn) {
    return `<div class="label">GOOGLE CALENDAR, EN LOS DOS SENTIDOS</div>
      <p class="small">${c.lastError ? '🟡' : '🟢'} Conectado · ${eventos(state.extEvents.length)}${c.lastImport ? ` · actualizado ${hora(c.lastImport)}` : ''}</p>
      <p class="muted small">Lo que anotas con hora sale en tu calendario "Turbo" de Google. Si lo mueves o borras allá, aquí también.</p>
      ${c.lastError ? `<p class="small warn-text">⚠️ Último intento falló: ${limpio(c.lastError)}</p>` : ''}
      <div class="row"><button class="btn ghost" data-act="calRefresh">Actualizar ahora</button><button class="btn danger ghost" data-act="calPuenteOff">Desconectar</button></div>`;
  }
  return `<div class="label">GOOGLE CALENDAR, EN LOS DOS SENTIDOS</div>
    <p class="muted small">Lo que anotas con hora sale en Google, y todo tu Google aparece aquí. Se arma una vez en el computador, en 5 min. Puede esperar a que estés en uno.</p>
    <details class="small"><summary><b>Paso a paso</b></summary>
      <ol class="muted">
        <li>En el <b>computador</b>, abre <b>script.google.com</b> → <b>Nuevo proyecto</b>.</li>
        <li>Borra lo que aparece y pega el código del puente: <button class="btn ghost" data-act="calPuenteCopy">Copiar código</button></li>
        <li>Guarda (💾). Arriba elige <b>probar</b> y toca <b>▶ Ejecutar</b>. Google pide permisos: <b>Revisar permisos</b> → tu cuenta → <b>Configuración avanzada</b> → <b>Ir a…</b> → <b>Permitir</b>.</li>
        <li><b>Implementar</b> → <b>Nueva implementación</b> → ⚙️ <b>Aplicación web</b>. Ejecutar como: <b>Yo</b>. Quién tiene acceso: <b>Cualquier persona</b>. → <b>Implementar</b>.</li>
        <li>Copia la <b>URL de la aplicación web</b> (termina en <b>/exec</b>) y pégala aquí.</li>
      </ol></details>
    <input class="input" id="puenteUrl" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
    <button class="btn" data-act="calPuente">Conectar</button>`;
}

export function calendarCard() {
  if (!hasServer()) return '';
  const c = state.calendar;
  if (c.puenteOn) {
    // Con el puente, el link .ics y el iCal sobran: solo se recuerda sacar el .ics viejo de Google.
    return `<section class="card"><h3>📅 Calendario</h3>${puenteCard()}
      ${c.token ? `<p class="muted small" style="margin-top:12px">¿Agregaste antes el link de Turbo a Google? Sácalo para no ver doble: en calendar.google.com, a la izquierda, "Turbo 🏎️" → ⋮ → <b>Anular suscripción</b>.</p>` : ''}
    </section>`;
  }
  return `<section class="card">
    <h3>📅 Calendario</h3>
    ${puenteCard()}
    <details class="small" style="margin-top:16px"><summary class="muted">Sin puente: Turbo solo ve tu Google (más lento)</summary>
    <div class="label">TURBO EN TU CALENDARIO</div>
    ${c.token ? `<p class="muted small">Tus clases, gym, eventos, pruebas y tareas con fecha aparecen en tu calendario y se actualizan solas.</p>
      <a class="btn" href="${webcalLink()}">📱 Agregar al Calendario del iPhone</a>
      <button class="btn ghost" data-act="calCopy">Copiar link (para Google Calendar)</button>
      <details class="muted small"><summary>¿Cómo lo agrego en Google Calendar?</summary>
        <p>En el computador: <b>calendar.google.com</b> → a la izquierda, junto a "Otros calendarios", toca <b>+</b> → <b>Desde URL</b> → pega el link → <b>Agregar calendario</b>.</p></details>`
      : `<p class="muted small">Haz que tus clases, gym, pruebas y tareas aparezcan en el Calendario del iPhone o en Google Calendar.</p>
      <button class="btn" data-act="calEnable">Activar</button>`}

    <div class="label" style="margin-top:16px">TU GOOGLE CALENDAR EN TURBO</div>
    ${c.importOn ? `<p class="small">${c.lastError ? '🟡' : '🟢'} Conectado · ${state.extEvents.length} eventos en los próximos 2 meses${c.lastImport ? ` · actualizado ${hora(c.lastImport)}` : ''}</p>
      ${c.lastError ? `<p class="small warn-text">⚠️ Último intento falló: ${limpio(c.lastError)}</p>` : ''}
      <div class="row"><button class="btn ghost" data-act="calRefresh">Actualizar ahora</button><button class="btn danger ghost" data-act="calImportOff">Desconectar</button></div>`
      : `<p class="muted small">Lo que anotes en Google Calendar aparece en Turbo (en Día y en los avisos).</p>
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
    </details>
  </section>`;
}

export const actions = {
  calPuenteCopy: async () => {
    // En Safari el portapapeles exige que el texto llegue como promesa dentro del mismo toque.
    const texto = fetch('/puente-google.txt').then(r => (r.ok ? r.text() : Promise.reject(new Error(r.status))));
    try {
      if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': texto.then(t => new Blob([t], { type: 'text/plain' })) })]);
      else await navigator.clipboard.writeText(await texto);
      toast('Código copiado. Pégalo en script.google.com');
    } catch {
      window.open('/puente-google.txt', '_blank');
    }
  },
  calPuente: async el => {
    const url = document.getElementById('puenteUrl').value.trim();
    if (!url) return toast('Pega la URL que termina en /exec');
    el.disabled = true;
    el.textContent = 'Conectando…';
    try {
      const { events, cambios } = await puenteSet(url);
      update(s => {
        s.calendar.puenteOn = true;
        s.calendar.importOn = true;
        s.calendar.lastImport = Date.now();
        s.calendar.lastError = null;
        s.extEvents = events;
        seguirGoogle(s, cambios);
      });
      toast(`🟢 Conectado: ${eventos(events.length)} de Google`);
    } catch (e) {
      toast(e.message);
      el.disabled = false;
      el.textContent = 'Conectar';
    }
  },
  calPuenteOff: async () => {
    if (!confirm('¿Desconectar el puente con Google? Lo que ya está en Google se queda allá.')) return;
    try {
      await puenteSet('');
    } catch {}
    update(s => { s.calendar.puenteOn = false; s.calendar.importOn = false; s.extEvents = []; });
    refreshExternal(true);
  },
  calEnable: async () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
    try {
      const r = await calendarEnable(token);
      update(s => { s.calendar.token = r.token || token; });
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
      toast(`🟢 Conectado: ${events.length} eventos encontrados`);
    } catch (e) {
      toast(e.message);
      el.disabled = false;
      el.textContent = 'Conectar';
    }
  },
  calRefresh: async el => {
    el.disabled = true;
    el.textContent = 'Actualizando…';
    const r = await refreshExternal(true);
    toast(r?.ok ? `🟢 ${state.extEvents.length} eventos actualizados` : `No se pudo actualizar: ${r?.error || 'error desconocido'}`);
    el.disabled = false;
    el.textContent = 'Actualizar ahora';
  },
  calImportOff: async () => {
    if (!confirm('¿Desconectar Google Calendar de Turbo?')) return;
    try {
      await calendarImportSet('');
    } catch {}
    update(s => { s.calendar.importOn = false; s.extEvents = []; });
  },
};

