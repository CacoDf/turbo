// Avisos que calcula el servidor (cron), desde el respaldo del estado y el calendario de Google.
// Es una función pura (sin base de datos ni red) para poder probarla con cualquier "ahora".
import { enChile, instante, keyOf, fromDayNum, hmToMin } from './tiempo.js';
import { huecos, opcionesHueco } from '../public/js/huecos.js';

export const MAX_POR_SERIE = 3;
export const MAX_HUECOS_DIA = 3; // huecos con aviso por día: más que eso es ruido y se terminan silenciando
export const HORIZONTE = 36 * 3600000;
export const DIA_MINIMO = 3 * 86400000; // tras 3 días sin abrir la app, los buenos días ofrecen el "día mínimo"
const MIN = 60000;

const EMOJI = { clase: '🎓', entreno: '🏋️', pega: '💼', otro: '📌', cal: '📅' };
// Eventos de Google que cuentan como clase (silencio mientras duran).
const CLASE = /\bclases?\b|c[aá]tedra|ayudant[ií]a|laboratorio/i;

// La frase cambia cada día (y en cada paso de una serie), sin azar: así se puede probar.
export const frase = (lista, dia, paso = 1) => lista[(dia + paso - 1) % lista.length];

const cosas = n => `${n} ${n === 1 ? 'cosa' : 'cosas'}`;
const F = {
  bloque: [
    'Deja lo que estás haciendo en un punto fácil de retomar.',
    'Anota dónde quedaste y parte tranquilo.',
    'Guarda lo que estás haciendo: en un rato vuelves.',
  ],
  // Buenos días: con tareas para hoy, solo con tareas sin fecha, o sin nada anotado.
  manana: [
    (n, t) => `Hoy: ${cosas(n)}. La primera es ${t}.`,
    (n, t) => `Para hoy tienes ${cosas(n)}. Parte con ${t}.`,
    (n, t) => `${t} va primero. Después vemos el resto.`,
  ],
  mananaLibre: [t => `Nada vence hoy. ¿Partimos con ${t}?`, t => `Día liviano. Si quieres: ${t}.`, t => `${t} te espera, sin apuro.`],
  mananaVacia: ['Anota qué tienes hoy (1 minuto).', '¿Qué tienes hoy? Anótalo en 1 minuto.', 'Un minuto para anotar el día y listo.'],
  manana2: ['¿Partimos? Un minuto para mirar el día.', 'Sigue en pie: mira qué va primero.', 'Cuando puedas: 1 minuto y quedas ordenado.'],
  minimo: ['Solo 2 minutos. Una cosa chica y listo.', 'Volver cuesta poco: 2 minutos y listo.', 'Hoy basta con 2 minutos. Toca y partimos.'],
  minimo2: ['Sigue en pie: 2 minutos cuando puedas.', 'Una cosa chica, 2 minutos. Nada más.', '¿Ahora? Son solo 2 minutos.'],
  habitos: [l => `Te faltan: ${l}`, l => `Quedan: ${l}. Uno basta.`, l => `Para cerrar el día: ${l}`],
  habitos2: [l => `Un recordatorio más: ${l}`, l => `Todavía hay tiempo: ${l}`, l => `Si te queda energía: ${l}`],
  // Hueco libre: 5 min antes, al empezar y a los 10 min (máximo 3). Saliendo de clase: al salir y a los 10 min.
  hueco: [
    (d, h, t) => `Tienes ${d} libres hasta las ${h}. ¿Partimos con ${t}?`,
    (d, h, t) => `${d} libres hasta las ${h}. Cabe ${t}.`,
    (d, h, t) => `Se viene un hueco de ${d}. Buena para ${t}.`,
  ],
  huecoSin: [
    (d, h) => `Tienes ${d} libres hasta las ${h}. Anota algo y Turbo te propone.`,
    (d, h) => `${d} libres hasta las ${h}. 5 minutos de lo que sea y listo.`,
    (d, h) => `Se viene un hueco de ${d}, hasta las ${h}.`,
  ],
  hueco2: ['Ya estás libre. Parte con lo primero de Ahora.', 'Empezó tu hueco. Un toque y partes.', 'Tiempo libre ahora: ¿5 minutos de algo?'],
  hueco3: ['Solo 5 minutos. Después decides.', 'Aunque sea 5 minutos: después puedes parar.', '5 minutos y listo. Lo que sea.'],
  foco: ['Listo. Puedes parar, o seguir 15 min.', 'Tiempo. Bien hecho: para o sigue un poco más.', 'Terminó tu foco. ¿Paras o sigues 15 min?'],
};

const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dur = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ''}`); // igual que fmtDuration en la app

const corto = (t, n = 40) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));

// Id corto y estable para un texto (títulos con tildes o emojis incluidos).
const hash = s => { let h = 5381; for (const c of String(s)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h.toString(36); };

// Bloques con hora de un día: horario propio y eventos de Google.
function bloquesDel(state, eventos, key, dow) {
  const propios = (state.schedule || []).filter(b => b.start && b.end && (b.date ? b.date === key : b.days?.includes(dow)));
  const google = eventos.filter(e => e.date === key && !e.allDay && e.start && e.end)
    .map(e => ({ id: `cal${e.start.replace(':', '')}-${hash(e.title)}`, title: e.title || '(sin título)', kind: CLASE.test(e.title || '') ? 'clase' : 'cal', start: e.start, end: e.end }));
  return [...propios, ...google];
}

// Tareas pendientes para un día: vencen ese día o antes, o se marcaron para hoy. Es el número del ícono.
export function pendientesDel(state, key) {
  return (state.tasks || []).filter(t => t && !t.done && (t.due ? t.due <= key : !!t.today));
}

// La tarea que cabe en un hueco: primero lo de hoy, después lo que vence antes.
function tareaQueCabe(state, key, min) {
  const deHoy = new Set(pendientesDel(state, key).map(t => t.id));
  const t = (state.tasks || []).filter(x => x && !x.done && (Number(x.minutes) || 25) <= min)
    .sort((a, b) => deHoy.has(b.id) - deHoy.has(a.id) || (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || 0) - (b.createdAt || 0))[0];
  return t ? `${corto(t.title)} (${Number(t.minutes) || 25} min)` : '';
}

function primeraTarea(state, key) {
  const abiertas = (state.tasks || []).filter(t => t && !t.done);
  const deHoy = pendientesDel(state, key);
  const lista = (deHoy.length ? deHoy : abiertas).slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || 0) - (b.createdAt || 0));
  return { hoy: deHoy.length, abiertas: abiertas.length, titulo: lista[0] ? corto(lista[0].title) : '' };
}

export function planAvisos({ state = {}, eventos = [], visto = null, ahora = Date.now() }) {
  const s = { remindBefore: 15, morningAt: '09:00', habitsAt: '21:00', reviewAt: '19:00', sleepAt: '00:30', wakeAt: '06:00', ...(state.settings || {}) };
  const antes = Number(s.remindBefore) || 0;
  const hoy = enChile(ahora).dia;
  const crudos = [];
  const clases = {};

  // Una serie son hasta 3 avisos del mismo momento; del 2.º en adelante se cancelan si abre la app.
  const serie = (id, base, pasos, comun) => pasos.slice(0, MAX_POR_SERIE).forEach((p, i) => crudos.push({
    ...comun, ...p, id: i ? `${id}-${i + 1}` : id, at: base + (p.tras || 0) * MIN, serie: id, paso: i + 1, inicio: base,
  }));

  for (let dia = hoy; dia <= hoy + 2; dia++) {
    const key = keyOf(dia);
    const dow = fromDayNum(dia).dow;
    const at = hm => instante(dia, hmToMin(hm));
    const bloques = bloquesDel(state, eventos, key, dow);
    clases[dia] = bloques.filter(b => b.kind === 'clase').map(b => ({ ini: at(b.start), fin: at(b.end) }));

    for (const b of bloques) {
      const inicio = at(b.start);
      serie(`blk-${b.id}-${key}`, inicio - antes * MIN, [{
        title: `${EMOJI[b.kind] || '📌'} ${corto(b.title, 60)} ${antes ? `en ${antes} min` : 'ahora'}`,
        body: `Parte a las ${b.start}. ${frase(F.bloque, dia)}`,
      }], { url: '/#/ahora', limite: inicio });
    }

    // Huecos libres entre cosas (no el de la mañana antes de todo): el día vacío ya lo cubren los buenos días.
    const opt = opcionesHueco(s, dow);
    const finales = new Set(bloques.map(b => hmToMin(b.end)));
    const conAviso = huecos(bloques, opt).filter(h => h.ini !== opt.desde || finales.has(h.ini)).slice(0, MAX_HUECOS_DIA);
    for (const h of conAviso) {
      const t = tareaQueCabe(state, key, h.min);
      const d = dur(h.min);
      const primero = { title: `🕳️ Hueco de ${d}`, body: t ? frase(F.hueco, dia)(d, hm(h.fin), t) : frase(F.huecoSin, dia)(d, hm(h.fin)) };
      const ultimo = { title: '🕳️ Solo 5 minutos', body: frase(F.hueco3, dia, 3) };
      // Saliendo de clase no se avisa antes (es silencio): el primero llega al terminar la clase y el último 10 min después.
      const trasClase = bloques.some(b => b.kind === 'clase' && hmToMin(b.start) < h.ini - 5 && hmToMin(b.end) >= h.ini);
      serie(`hueco-${key}-${hm(h.ini)}`, at(hm(h.ini)) - (trasClase ? 0 : 5 * MIN), trasClase
        ? [primero, { ...ultimo, tras: 10 }]
        : [primero, { title: '🕳️ Estás libre', body: frase(F.hueco2, dia, 2), tras: 5 }, { ...ultimo, tras: 15 }],
      { url: '/#/ahora', limite: at(hm(h.fin)) - 10 * MIN });
    }

    // Buenos días o día mínimo: la misma serie (mismo id), así abrir la app después de uno no dispara el otro.
    const manana = at(s.morningAt);
    if (visto != null && manana - visto >= DIA_MINIMO) {
      serie(`manana-${key}`, manana, [
        { title: '🌱 Día mínimo', body: frase(F.minimo, dia) },
        { title: '🌱 Día mínimo', body: frase(F.minimo2, dia, 2), tras: 20 },
      ], { url: '/?minimo=1#/ahora' });
    } else {
      const { hoy: n, abiertas, titulo } = primeraTarea(state, key);
      const body = n ? frase(F.manana, dia)(n, titulo) : abiertas ? frase(F.mananaLibre, dia)(titulo) : frase(F.mananaVacia, dia);
      serie(`manana-${key}`, manana, [
        { title: '☀️ Buenos días', body },
        { title: '☀️ ¿Partimos?', body: frase(F.manana2, dia, 2), tras: 20 },
      ], { url: abiertas ? '/#/ahora' : '/#/capturar' });
    }

    const log = state.habitLog?.[key] || {};
    const faltan = (state.habits || []).filter(h => !h.archived && (log[h.id] || 0) < (h.target || 1));
    if (faltan.length) {
      const lista = corto(faltan.map(h => `${h.emoji || ''} ${h.name}`.trim()).join(', '), 120);
      serie(`habitos-${key}`, at(s.habitsAt), [
        { title: '✅ Revisa tus hábitos', body: frase(F.habitos, dia)(lista) },
        { title: '✅ Hábitos', body: frase(F.habitos2, dia, 2)(lista), tras: 60 },
      ], { url: '/#/habitos' });
    }

    for (const r of state.routines || []) {
      if (!r.at || !r.days?.includes(dow) || state.routineLog?.[key]?.[r.id]) continue;
      serie(`rt-${r.id}-${key}`, at(r.at), [{ title: `${r.emoji || '📋'} Rutina de ${r.name}`, body: `${r.steps?.length || 0} pasos. Abre Turbo y sigue uno a la vez.` }], { url: '/#/rutinas' });
    }

    if (dow === 0) {
      serie(`revision-${key}`, at(s.reviewAt || '19:00'), [{ title: '🧭 Revisión semanal (5 min)', body: 'Mira cómo te fue y elige tus 3 prioridades de la semana.' }], { url: '/#/revision' });
    }

    const manianaKey = keyOf(dia + 1);
    const pruebas = (state.exams || []).filter(e => e && !e.done && e.date === manianaKey);
    if (pruebas.length) {
      serie(`prueba-${key}`, at('20:00'), [{ title: '📚 Mañana tienes evaluación', body: `${corto(pruebas.map(e => e.title).join(' · '), 120)}. Repaso corto y a dormir temprano.` }], { url: '/#/estudios' });
    }
    const vencen = (state.tasks || []).filter(t => t && !t.done && t.due === manianaKey);
    if (vencen.length) {
      serie(`vence-${key}`, at('19:00'), [{ title: vencen.length === 1 ? '⏰ Mañana vence algo' : `⏰ Mañana vencen ${vencen.length} cosas`, body: corto(vencen.map(t => t.title).join(' · '), 120) }], { url: '/#/ahora' });
    }
  }

  // Fin del foco: lo partió él, así que no tiene silencio.
  const f = state.focus;
  if (f?.endAt) {
    const body = f.minimo ? 'Listo 💚 Eso era todo por hoy.' : frase(F.foco, hoy);
    serie(`foco-${f.start || 0}-${f.endAt}`, f.endAt, [{ title: f.minimo ? '💚 Listo' : '🏁 ¡Tiempo!', body }], { url: '/#/foco', sinSilencio: true });
  }

  const sueno = hmToMin(s.sleepAt);
  const despierta = hmToMin(s.wakeAt);
  const deNoche = t => {
    if (sueno === despierta) return false;
    const m = enChile(t).min;
    return sueno < despierta ? m >= sueno && m < despierta : m >= sueno || m < despierta;
  };
  const enClase = t => (clases[enChile(t).dia] || []).find(c => t >= c.ini && t < c.fin);

  const porSerie = {};
  const ultimo = {}; // hora final del paso anterior de cada serie
  const previsto = {}; // hora que tenía planeada ese paso anterior
  const out = [];
  for (const a of crudos.sort((x, y) => x.paso - y.paso)) {
    // Si el paso anterior se corrió (p. ej. por una clase), este conserva su distancia: nunca dos juntos.
    let at = ultimo[a.serie] != null ? Math.max(a.at, ultimo[a.serie] + (a.at - previsto[a.serie])) : a.at;
    if (!a.sinSilencio) {
      // En clase: se corre al final (varias clases seguidas = varias vueltas). Si ya no sirve, se descarta.
      for (let c = enClase(at), i = 0; c && i < 6; c = enClase(at), i++) at = c.fin;
      if (a.limite != null && at > a.limite) continue;
      if (deNoche(at)) continue;
    }
    previsto[a.serie] = a.at;
    ultimo[a.serie] = at; // antes de filtrar por ventana: un paso ya pasado igual corre a los siguientes
    if (at < ahora - 5 * MIN || at > ahora + HORIZONTE) continue;
    porSerie[a.serie] = (porSerie[a.serie] || 0) + 1;
    if (porSerie[a.serie] > MAX_POR_SERIE) continue;
    out.push({
      id: a.id, at, title: a.title, body: a.body || '', url: a.url || '/', serie: a.serie, paso: a.paso, inicio: a.inicio,
      badge: pendientesDel(state, keyOf(enChile(at).dia)).length,
    });
  }
  return out.sort((x, y) => x.at - y.at);
}
