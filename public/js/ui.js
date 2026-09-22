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

// Pitido corto al terminar el temporizador (el primer toque del usuario desbloquea el audio en iOS).
let audioCtx;
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

export function beep() {
  if (!audioCtx) return;
  [0, 0.25, 0.5].forEach((t, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = [660, 880, 990][i];
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t);
    o.stop(audioCtx.currentTime + t + 0.22);
  });
}
