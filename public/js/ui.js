// Piezas visuales reutilizables: auto SVG, anillo de tiempo, barras, avisos y hojas inferiores.
import { esc } from './util.js';

// Silueta lateral de auto, pintada con el color del modelo.
export function carSvg(color = '#5cc8b0', { size = 120, locked = false } = {}) {
  const body = locked ? 'var(--line)' : color;
  const glass = locked ? 'var(--surface2)' : 'rgba(210,235,255,.55)';
  return `<svg viewBox="0 0 120 50" width="${size}" height="${size * 50 / 120}" aria-hidden="true">
    <path d="M8 34 C8 28 12 26 20 25 L36 23 L48 13 C51 11 54 10 58 10 L78 10 C83 10 86 12 89 15 L97 23 L108 26 C113 27 115 30 115 34 L115 37 C115 39 114 40 112 40 L8 40 C6 40 5 39 5 37 Z" fill="${body}"/>
    <path d="M50 22 L58 14 C59 13 60 13 62 13 L70 13 L70 22 Z M74 22 L74 13 L78 13 C81 13 83 14 85 16 L91 22 Z" fill="${glass}"/>
    <circle cx="30" cy="40" r="8.5" fill="#15181d"/><circle cx="30" cy="40" r="4" fill="${locked ? 'var(--line)' : '#9aa4b2'}"/>
    <circle cx="92" cy="40" r="8.5" fill="#15181d"/><circle cx="92" cy="40" r="4" fill="${locked ? 'var(--line)' : '#9aa4b2'}"/>
    ${locked ? '' : '<rect x="108" y="29" width="6" height="3" rx="1.5" fill="#ffe7a8"/>'}
  </svg>`;
}

export function ring(pct, { size = 260, stroke = 16, color = 'var(--accent)', inner = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--surface2)" stroke-width="${stroke}" fill="none"/>
      <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-inner">${inner}</div>
  </div>`;
}

export function setRing(el, pct) {
  const fg = el?.querySelector('.ring-fg');
  if (!fg) return;
  const c = Number(fg.getAttribute('stroke-dasharray'));
  fg.setAttribute('stroke-dashoffset', c * (1 - pct));
}

export function bar(pct, color = 'var(--accent)') {
  return `<div class="bar"><div style="width:${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%;background:${color}"></div></div>`;
}

let toastTimer;
export function toast(msg, { big = false } = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = big ? 'show big' : 'show';
  el.innerHTML = esc(msg);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), big ? 3200 : 2200);
}

// Hoja inferior (modal). El contenido usa los mismos data-act que el resto de la app.
export function openSheet(html) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.id = 'sheet';
  wrap.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
}

export function closeSheet() {
  document.getElementById('sheet')?.remove();
}

export function celebrate(text) {
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `<div>${esc(text)}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// Audio solo para el pomodoro: se despierta al partir un foco (siempre con un toque, como exige iOS) y se
// duerme al terminar. Un audio despierto todo el rato hace que en el iPhone las notificaciones suenen distinto.
let audioCtx;
let dormirId = null;
export function unlockAudio() {
  clearTimeout(dormirId); // si había un "dormir" pendiente (de la alarma anterior), ya no corresponde
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

export function dormirAudio() {
  try {
    if (audioCtx?.state === 'running') audioCtx.suspend();
  } catch {}
}

// Alarma suave del pomodoro: una campanita grave, 3 veces (cada 4 s) o hasta que toques algo.
// Al terminar el foco baja (a descansar); al terminar el descanso sube (a partir). Solo suena con Turbo abierta:
// con el teléfono bloqueado avisa la notificación, con el sonido del iPhone.
let alarmaId = null;
function campanita(notas) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  notas.forEach((f, i) => {
    const t = t0 + i * 0.4;
    for (const [mult, vol] of [[1, 0.12], [2, 0.025]]) { // nota + un armónico bajito: suena a campana, no a pitido
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 1.7);
    }
  });
}

export function alarma(tipo = 'foco') {
  pararAlarma();
  try { if (audioCtx?.state === 'suspended') audioCtx.resume(); } catch {}
  const notas = tipo === 'descanso' ? [392, 523.25] : [523.25, 392];
  let veces = 1;
  campanita(notas);
  alarmaId = setInterval(() => (++veces > 3 ? pararAlarma() : campanita(notas)), 4000);
}

export function pararAlarma() {
  if (!alarmaId) return;
  clearInterval(alarmaId);
  alarmaId = null;
  dormirId = setTimeout(() => { if (!alarmaId) dormirAudio(); }, 2000); // deja terminar la última campanita
}
