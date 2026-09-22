// Escudo: protocolo SOS para las ganas, contador privado, patrones y guía de bloqueo.
// Estos datos son privados: nunca se mandan a la IA ni se comparten.
import { state, update } from '../store.js';
import { XP, shieldDays } from '../game.js';
import { esc, fmtClock } from '../util.js';
import { unlockAudio, beep } from '../ui.js';
import { reward } from '../actions.js';
import { rerender } from '../router.js';

const ACTIONS = [
  ['💪', '20 flexiones o sentadillas, ya'],
  ['🚶', 'Salir a caminar 10 minutos'],
  ['🚿', 'Ducha (fría si te atreves)'],
  ['📞', 'Escribirle o llamar a alguien'],
  ['🎧', 'Poner música fuerte y moverte'],
  ['📵', 'Dejar el celu en otra pieza'],
];

const TRIGGERS = ['Aburrido', 'Solo', 'Cansado', 'Estresado', 'Ansioso', 'Bajoneado', 'En la cama con el celu', 'Después de reels / redes', 'Evitando algo pendiente'];

const GUIDE = [
  ['screentime', 'Bloquear sitios para adultos en el iPhone', 'Ajustes → Tiempo en pantalla → Contenido y privacidad (actívalo) → Restricciones de contenido de App Store → Contenido web → <b>Limitar sitios web para adultos</b>. Funciona en Safari y en las apps que abren páginas.'],
  ['passcode', 'Que otra persona ponga el código', 'Ajustes → Tiempo en pantalla → <b>Usar código de Tiempo en pantalla</b>. Pásale el teléfono a tu polola o a alguien de confianza para que lo invente. Así en un momento de impulso no lo puedes desactivar.'],
  ['dns', 'Filtro en todas las apps (DNS)', 'Instala la app gratis <b>1.1.1.1</b> de Cloudflare → menú → Avanzado → Opciones de conexión → Configuración DNS → <b>1.1.1.1 for Families</b> → "Bloquear malware y contenido para adultos". Actívala con el switch principal.'],
  ['reels', 'Límite para reels', 'Ajustes → Tiempo en pantalla → Límites de apps → Agregar límite → Redes sociales → Instagram/TikTok → por ejemplo <b>45 min al día</b>. Con el código en manos de otra persona funciona mejor.'],
  ['pc', 'Filtro en el PC (Windows)', 'Configuración → Red e Internet → Wi-Fi (o Ethernet) → Propiedades de hardware → Asignación de servidor DNS → Editar → Manual → IPv4: <b>1.1.1.3</b> y <b>1.0.0.3</b>.'],
  ['night', 'Celu fuera de la cama', 'Cargador fuera de la pieza o lejos de la cama. La noche en la cama con el celu es uno de los gatillos más comunes.'],
];

let phase = null;
let flow = {};

function header() {
  const days = shieldDays();
  return `<header class="top"><h1>🛡️ Escudo</h1></header>
    <section class="card hero center">
      <div class="big-num">${days}</div><div class="muted">${days === 1 ? 'día' : 'días'} de escudo arriba · récord ${Math.max(state.shield.best, days)}</div>
    </section>`;
}

function sosButton() {
  return `<button class="btn huge shield" data-act="sosStart">Tengo ganas</button>
    <p class="muted small center">No tienes que pelear solo con la fuerza de voluntad. Son 10 minutos: las ganas suben, llegan a un máximo y bajan.</p>`;
}

function breathe() {
  return `<section class="card center sos">
    <h2>Primero, respira</h2>
    <p class="muted">La ola sube, llega arriba y baja. No tienes que hacer nada más que dejarla pasar.</p>
    <div class="breath"><div class="breath-circle"></div><div id="breathTxt">Inhala</div></div>
    <div class="muted" id="breathLeft">1:00</div>
    <button class="btn" data-act="sosTo" data-p="act">Siguiente →</button>
  </section>`;
}

function act() {
  if (flow.action) {
    return `<section class="card center sos">
      <h2>${flow.action[0]} ${esc(flow.action[1])}</h2>
      <p class="muted">Hazlo ahora. Vuelve cuando termine el tiempo.</p>
      <div class="big-num" id="sosClock">${fmtClock(flow.until - Date.now())}</div>
      <button class="btn" data-act="sosTo" data-p="log">Ya pasó la ola →</button>
    </section>`;
  }
  return `<section class="card sos"><h2 class="center">Cambia de canal</h2>
    <p class="muted center">Elige una. Mover el cuerpo baja las ganas más rápido.</p>
    ${ACTIONS.map((a, i) => `<button class="btn ghost left" data-act="sosAction" data-i="${i}">${a[0]} ${a[1]}</button>`).join('')}
  </section>`;
}

function log() {
  const sel = flow.triggers || [];
  return `<section class="card sos"><h2>¿Cómo estabas?</h2>
    <p class="muted">Solo para ti. Sirve para ver tus patrones.</p>
    <div class="chips pick">${TRIGGERS.map(t => `<button class="chip ${sel.includes(t) ? 'on' : ''}" data-act="sosTrig" data-t="${t}">${t}</button>`).join('')}</div>
    <h3>¿Cómo terminó?</h3>
    <button class="btn" data-act="sosEnd" data-r="win">💪 La ola pasó</button>
    <button class="btn ghost" data-act="sosEnd" data-r="slip">Caí</button>
  </section>`;
}

function patterns() {
  const ev = state.shield.events;
  if (ev.length < 2) return '';
  const count = {};
  ev.forEach(e => e.triggers.forEach(t => (count[t] = (count[t] || 0) + 1)));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const buckets = { 'Mañana': 0, 'Tarde': 0, 'Noche': 0, 'Madrugada': 0 };
  ev.forEach(e => {
    const h = new Date(e.t).getHours();
    buckets[h < 6 ? 'Madrugada' : h < 12 ? 'Mañana' : h < 19 ? 'Tarde' : 'Noche']++;
  });
  const max = Math.max(...Object.values(buckets), 1);
  const wins = ev.filter(e => e.result === 'win').length;
  return `<h3 class="group">Tus patrones</h3>
    <section class="card">
      <p>Olas surfeadas: <b>${wins}</b> de ${ev.length}</p>
      ${top.length ? `<p class="muted small">Gatillos más comunes:</p>${top.map(([t, n]) => `<div class="row between"><span>${esc(t)}</span><b>${n}</b></div>`).join('')}` : ''}
      <p class="muted small">Momento del día:</p>
      ${Object.entries(buckets).map(([k, n]) => `<div class="hbar"><span>${k}</span><div><div style="width:${(n / max) * 100}%"></div></div><b>${n}</b></div>`).join('')}
    </section>`;
}

function guide() {
  const g = state.shield.guide;
  const done = GUIDE.filter(([id]) => g[id]).length;
  return `<h3 class="group">Configura tus bloqueos <span class="muted">${done}/${GUIDE.length}</span></h3>
    <p class="muted small">Turbo no puede bloquear sitios por sí sola (Apple no lo permite a apps web), pero tu iPhone sí. Hazlo una vez y queda.</p>
    ${GUIDE.map(([id, title, body]) => `<details class="card guide ${g[id] ? 'is-done' : ''}">
      <summary><button class="check ${g[id] ? 'on' : ''}" data-act="sosGuide" data-id="${id}" aria-label="Hecho"></button> ${title}</summary>
      <p>${body}</p></details>`).join('')}`;
}

const cancel = '<button class="link" data-act="sosCancel">Salir sin registrar</button>';

export function render() {
  if (phase === 'breathe') return breathe() + cancel;
  if (phase === 'act') return act() + cancel;
  if (phase === 'log') return log() + cancel;
  return `${header()}${sosButton()}${patterns()}${guide()}`;
}

export function mount() {
  if (phase === 'breathe') {
    const txt = ['Inhala', 'Mantén', 'Exhala', 'Mantén'];
    const t0 = flow.breathStart || (flow.breathStart = Date.now());
    const id = setInterval(() => {
      const el = document.getElementById('breathTxt');
      const left = document.getElementById('breathLeft');
      if (!el) return clearInterval(id);
      const s = (Date.now() - t0) / 1000;
      el.textContent = txt[Math.floor(s / 4) % 4];
      const rem = Math.max(0, 60 - s);
      left.textContent = rem > 0 ? fmtClock(rem * 1000) : 'Listo ✓';
    }, 250);
    return () => clearInterval(id);
  }
  if (phase === 'act' && flow.action) {
    let beeped = false;
    const id = setInterval(() => {
      const el = document.getElementById('sosClock');
      if (!el) return clearInterval(id);
      const left = flow.until - Date.now();
      el.textContent = left > 0 ? fmtClock(left) : '¡Lo lograste!';
      if (left <= 0 && !beeped) {
        beeped = true;
        beep();
      }
    }, 1000);
    return () => clearInterval(id);
  }
}

export const actions = {
  sosStart: () => {
    unlockAudio();
    phase = 'breathe';
    flow = { t: Date.now() };
    rerender();
  },
  sosCancel: () => {
    phase = null;
    flow = {};
    rerender();
  },
  sosTo: el => {
    phase = el.dataset.p;
    rerender();
  },
  sosAction: el => {
    flow.action = ACTIONS[Number(el.dataset.i)];
    flow.until = Date.now() + 10 * 60000;
    rerender();
  },
  sosTrig: el => {
    const t = el.dataset.t;
    flow.triggers = flow.triggers || [];
    flow.triggers = flow.triggers.includes(t) ? flow.triggers.filter(x => x !== t) : [...flow.triggers, t];
    el.classList.toggle('on');
  },
  sosEnd: el => {
    const result = el.dataset.r;
    const days = shieldDays();
    update(s => {
      s.shield.events.unshift({ t: flow.t, triggers: flow.triggers || [], action: flow.action?.[1] || null, result });
      if (result === 'slip') {
        s.shield.best = Math.max(s.shield.best, days);
        s.shield.since = Date.now();
      }
    });
    phase = null;
    flow = {};
    if (result === 'win') reward(XP.shieldWin, 'shield', 'Surfeaste la ola 🌊');
    else reward(XP.shieldLog, 'shield', 'Anotado sin culpa. Tu récord queda guardado.');
    rerender();
  },
  sosGuide: (el, ev) => {
    ev.preventDefault();
    update(s => { s.shield.guide[el.dataset.id] = !s.shield.guide[el.dataset.id]; });
  },
};
