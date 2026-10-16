// Cálculo de avisos del servidor (src/avisos.js): función pura, se prueba con un "ahora" fijo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAvisos, MAX_POR_SERIE } from '../../src/avisos.js';
import { instante, dayNum, enChile } from '../../src/tiempo.js';

// Martes 20-oct-2026 en Chile (horario de verano, UTC-3).
const MAR = dayNum(2026, 10, 20);
const a = (dia, hm) => { const [h, m] = hm.split(':').map(Number); return instante(dia, h * 60 + m); };
const hora = t => { const x = enChile(t); return `${String(Math.floor(x.min / 60)).padStart(2, '0')}:${String(x.min % 60).padStart(2, '0')}`; };
const SIN_RUIDO = { habits: [], routines: [] }; // los valores de fábrica agregan hábitos y rutinas: aquí se apagan
const plan = (state, extra = {}) => planAvisos({ ahora: a(MAR, '07:00'), ...extra, state: { ...SIN_RUIDO, ...state } });
const ids = lista => lista.map(x => x.id);

test('bloque propio y evento de Google avisan 15 min antes; un evento distinto a la misma hora también', () => {
  const r = plan({ schedule: [{ id: 'gym', title: 'Gym', kind: 'entreno', days: [2], start: '18:00', end: '19:30' }] }, {
    eventos: [
      { title: 'Dentista', date: '2026-10-20', start: '16:00', end: '17:00', allDay: false },
      { title: 'Prueba Cálculo', date: '2026-10-20', start: '18:00', end: '19:30', allDay: false },
      { title: 'Cumple', date: '2026-10-20', allDay: true },
    ],
  });
  const gym = r.find(x => x.id === 'blk-gym-2026-10-20');
  assert.equal(hora(gym.at), '17:45');
  assert.equal(gym.title, '🏋️ Gym en 15 min');
  const dentista = r.find(x => x.title.startsWith('📅 Dentista'));
  assert.equal(hora(dentista.at), '15:45');
  assert.equal(dentista.url, '/#/ahora');
  assert.ok(r.some(x => x.title === '📅 Prueba Cálculo en 15 min'), 'la prueba de Google a la misma hora que el gym no se pierde');
  assert.ok(!r.some(x => /Cumple/.test(x.title)), 'sin eventos de todo el día');
});

test('eventos con títulos que solo difieren en emojis o tildes no chocan', () => {
  const r = plan({}, { eventos: [
    { title: '🎂', date: '2026-10-20', start: '16:00', end: '17:00' }, { title: '🦷', date: '2026-10-20', start: '16:00', end: '17:00' },
    { title: 'Café', date: '2026-10-20', start: '18:00', end: '19:00' }, { title: 'Cafe', date: '2026-10-20', start: '18:00', end: '19:00' },
  ] });
  const ev = r.filter(x => x.title.startsWith('📅'));
  assert.equal(ev.length, 4);
  assert.equal(new Set(ev.map(x => x.id)).size, 4);
});

test('buenos días: serie de 2 (09:00 y 09:20) y ninguna serie pasa de 3', () => {
  const r = plan({ tasks: [{ id: 't1', title: 'Pagar la luz', due: '2026-10-20' }], habits: [{ id: 'h1', name: 'Agua', emoji: '💧', target: 1 }] });
  const m = r.filter(x => x.serie === 'manana-2026-10-20');
  assert.deepEqual(m.map(x => [x.paso, hora(x.at)]), [[1, '09:00'], [2, '09:20']]);
  assert.equal(m[1].inicio, m[0].at, 'el segundo sabe cuándo partió la serie (para cancelarse si abre la app)');
  assert.match(m[0].body, /Pagar la luz/);
  const porSerie = {};
  for (const x of r) porSerie[x.serie] = (porSerie[x.serie] || 0) + 1;
  assert.ok(Object.values(porSerie).every(n => n <= MAX_POR_SERIE));
  assert.equal(new Set(ids(r)).size, r.length, 'ids únicos');
});

test('silencio de noche: nada entre 00:30 y 06:00 (y funciona si cruza la medianoche)', () => {
  const ahora = a(MAR, '20:00');
  const r = plan({ settings: { morningAt: '05:59', habitsAt: '00:45' }, habits: [{ id: 'h1', name: 'Agua', target: 1 }],
    routines: [{ id: 'r1', name: 'Noche', emoji: '🌙', at: '02:00', days: [0, 1, 2, 3, 4, 5, 6], steps: [] }] }, { ahora });
  assert.ok(r.every(x => { const m = enChile(x.at).min; return m < 30 || m >= 360; }), r.map(x => hora(x.at)).join(' '));
  assert.ok(r.some(x => x.serie === 'manana-2026-10-21' && hora(x.at) === '06:19'), 'el segundo de los buenos días sí cae despierto');
  const r2 = plan({ settings: { morningAt: '06:00' } }, { ahora });
  assert.ok(r2.some(x => x.id === 'manana-2026-10-21' && hora(x.at) === '06:00'));
  const r3 = plan({ settings: { morningAt: '07:00', sleepAt: '23:30', wakeAt: '07:30' } }, { ahora });
  assert.ok(!r3.some(x => x.serie === 'manana-2026-10-21'), '23:30–07:30 cruza la medianoche: 07:00 y 07:20 en silencio');
  assert.ok(!r3.some(x => { const m = enChile(x.at).min; return m >= 23 * 60 + 30 || m < 7 * 60 + 30; }));
});

test('en clase: el aviso se corre al final; si ya no sirve, se descarta', () => {
  const r = plan({ schedule: [{ id: 'c1', title: 'Clases', kind: 'clase', days: [2], start: '08:30', end: '11:30' }] }, {
    eventos: [
      { title: 'Reunión', date: '2026-10-20', start: '11:40', end: '12:00' },
      { title: 'Llamada', date: '2026-10-20', start: '10:00', end: '10:30' },
      { title: 'Cátedra Finanzas', date: '2026-10-20', start: '12:00', end: '13:30' },
    ],
  });
  assert.deepEqual(r.filter(x => x.serie === 'manana-2026-10-20').map(x => hora(x.at)), ['11:30', '11:50'], 'buenos días al salir, y el segundo conserva sus 20 min');
  const tarde = plan({ schedule: [{ id: 'c1', title: 'Clases', kind: 'clase', days: [2], start: '08:30', end: '11:30' }] }, { ahora: a(MAR, '11:40') });
  assert.deepEqual(tarde.filter(x => x.serie === 'manana-2026-10-20').map(x => [x.paso, hora(x.at)]), [[2, '11:50']], 'replanificar a las 11:40 no pierde el segundo');
  assert.equal(hora(r.find(x => x.title.startsWith('📅 Reunión')).at), '11:30');
  assert.ok(!r.some(x => x.title.includes('Llamada')), 'avisar de la llamada después de que empezó no sirve');
  const catedra = r.find(x => x.title.includes('Cátedra'));
  assert.ok(catedra.title.startsWith('🎓'), 'un evento de Google que dice cátedra cuenta como clase');
  const r2 = plan({ settings: { habitsAt: '12:30' }, habits: [{ id: 'h1', name: 'Agua', target: 1 }] }, {
    eventos: [{ title: 'Cátedra Finanzas', date: '2026-10-20', start: '12:00', end: '13:30' }, { title: 'Almuerzo', date: '2026-10-20', start: '12:15', end: '12:45' }],
  });
  assert.equal(hora(r2.find(x => x.id === 'habitos-2026-10-20').at), '13:30', 'silencio en la cátedra, no en cualquier evento');
});

test('buenos días: cuenta las tareas de hoy, no todas', () => {
  const tasks = [{ id: 'a', title: 'Informe', due: '2026-10-20' }, ...Array.from({ length: 13 }, (_, i) => ({ id: `x${i}`, title: `Otra ${i}` }))];
  const body = plan({ tasks }).find(x => x.id === 'manana-2026-10-20').body;
  assert.match(body, /Informe/);
  assert.doesNotMatch(body, /14/);
  const libre = plan({ tasks: [{ id: 'b', title: 'Ordenar pieza' }] }).find(x => x.id === 'manana-2026-10-20');
  assert.match(libre.body, /Ordenar pieza/);
  assert.doesNotMatch(libre.body, /Hoy: /, 'sin tareas para hoy no dice "Hoy: N cosas"');
});

test('las frases rotan: los buenos días cambian de un día al siguiente', () => {
  const r = plan({ tasks: [{ id: 't1', title: 'Pagar la luz' }] });
  const hoy = r.find(x => x.id === 'manana-2026-10-20');
  const manana = r.find(x => x.id === 'manana-2026-10-21');
  assert.notEqual(hoy.body, manana.body);
  assert.notEqual(r.find(x => x.id === 'manana-2026-10-20-2').body, r.find(x => x.id === 'manana-2026-10-21-2').body);
});

test('día mínimo: tras 3 días sin abrir, los buenos días ofrecen 2 minutos y llevan a Ahora', () => {
  const ahora = a(MAR, '07:00');
  const r = plan({}, { visto: ahora - 3 * 86400000 });
  const m = r.find(x => x.id === 'manana-2026-10-20');
  assert.equal(m.title, '🌱 Día mínimo', 'misma serie que los buenos días: abrir después de uno no dispara el otro');
  assert.equal(m.url, '/?minimo=1#/ahora');
  assert.match(m.body, /2 minutos/);
  assert.doesNotMatch(m.body, /días sin|no abriste|abandon/i, 'sin culpa');
  const titulo = (lista, id) => lista.find(x => x.id === id)?.title;
  assert.equal(titulo(plan({}, { visto: ahora - 1 * 86400000 }), 'manana-2026-10-20'), '☀️ Buenos días');
  const r3 = plan({}, { visto: ahora - 2.5 * 86400000 });
  assert.equal(titulo(r3, 'manana-2026-10-20'), '☀️ Buenos días');
  assert.equal(titulo(r3, 'manana-2026-10-21'), '🌱 Día mínimo', 'mañana ya serían 3 días');
  assert.equal(titulo(plan({}, { visto: null }), 'manana-2026-10-20'), '☀️ Buenos días', 'sin dato de apertura: normal');
});

test('rutina hecha no avisa; pendiente sí', () => {
  const routines = [{ id: 'r1', name: 'Mañana', emoji: '☀️', at: '08:00', days: [2], steps: [{}, {}] }];
  assert.ok(plan({ routines }).some(x => x.id === 'rt-r1-2026-10-20' && x.body.startsWith('2 pasos')));
  assert.ok(!plan({ routines, routineLog: { '2026-10-20': { r1: true } } }).some(x => x.id === 'rt-r1-2026-10-20'));
});

test('fin del foco a la 01:00 sí avisa (lo partió él), con id propio por sesión', () => {
  const ahora = a(MAR, '00:50');
  const r = plan({ focus: { start: ahora, endAt: a(MAR, '01:00'), plannedMin: 10 } }, { ahora });
  const f = r.find(x => x.url === '/#/foco');
  assert.equal(f.id, `foco-${ahora}-${a(MAR, '01:00')}`);
  const alargado = plan({ focus: { start: ahora, endAt: a(MAR, '01:15'), plannedMin: 25 } }, { ahora }).find(x => x.url === '/#/foco');
  assert.notEqual(alargado.id, f.id, 'alargar el foco da un aviso nuevo (el primero ya se mandó)');
  assert.equal(f.title, '🏁 ¡Tiempo!');
  assert.equal(hora(f.at), '01:00');
  const m = plan({ focus: { start: ahora, endAt: a(MAR, '01:00'), plannedMin: 2, minimo: true } }, { ahora }).find(x => x.url === '/#/foco');
  assert.equal(m.title, '💚 Listo');
  assert.doesNotMatch(m.body, /seguir|15 min/i, 'el día mínimo no ofrece alargar');
});

test('vence mañana: un solo aviso a las 19:00 aunque sean varias; prueba mañana a las 20:00', () => {
  const r = plan({
    tasks: [{ id: 'a', title: 'Informe', due: '2026-10-21' }, { id: 'b', title: 'Pagar', due: '2026-10-21' }, { id: 'c', title: 'Hecha', due: '2026-10-21', done: true }],
    exams: [{ id: 'e1', title: 'Prueba 2', date: '2026-10-21' }],
  });
  const v = r.filter(x => x.serie === 'vence-2026-10-20');
  assert.equal(v.length, 1);
  assert.equal(v[0].title, '⏰ Mañana vencen 2 cosas');
  assert.equal(v[0].body, 'Informe · Pagar');
  assert.equal(hora(v[0].at), '19:00');
  assert.equal(hora(r.find(x => x.id === 'prueba-2026-10-20').at), '20:00');
});

test('número del ícono: tareas que vencen ese día o antes, o marcadas para hoy', () => {
  const r = plan({ tasks: [
    { id: 'a', title: 'Atrasada', due: '2026-10-18' }, { id: 'b', title: 'Hoy', due: '2026-10-20' }, { id: 'c', title: 'Mañana', due: '2026-10-21' },
    { id: 'd', title: 'Para hoy', today: true }, { id: 'e', title: 'Hecha', due: '2026-10-19', done: true }, null,
  ] });
  assert.equal(r.find(x => x.id === 'manana-2026-10-20').badge, 3);
  assert.equal(r.find(x => x.id === 'manana-2026-10-21').badge, 4);
});

test('solo las próximas 36 horas, y nada del pasado', () => {
  const ahora = a(MAR, '07:00');
  const r = plan({ settings: { morningAt: '06:00' } });
  assert.ok(r.every(x => x.at >= ahora - 5 * 60000 && x.at <= ahora + 36 * 3600000));
  assert.ok(!r.some(x => x.id === 'manana-2026-10-20'), 'los buenos días de las 06:00 ya pasaron');
  assert.ok(!r.some(x => x.id.endsWith('2026-10-22') && enChile(x.at).min > 19 * 60));
});

test('cambio de horario en Chile: la hora de pared se respeta', () => {
  // 2026: el sábado 5 de septiembre a las 24:00 pasa a ser 01:00 (UTC-4 → UTC-3).
  const r = planAvisos({ ahora: Date.UTC(2026, 8, 5, 11, 0), state: SIN_RUIDO });
  assert.equal(r.find(x => x.id === 'manana-2026-09-05').at, Date.UTC(2026, 8, 5, 13, 0), '09:00 UTC-4');
  assert.equal(r.find(x => x.id === 'manana-2026-09-06').at, Date.UTC(2026, 8, 6, 12, 0), '09:00 UTC-3');
});

test('un evento anotado en Turbo (una vez, con fecha) avisa 15 min antes igual que uno de Google', () => {
  const r = plan({ schedule: [{ id: 'dent', title: 'Dentista', kind: 'otro', days: [], date: '2026-10-22', start: '15:00', end: '16:00', src: 'turbo' }] }, { ahora: a(MAR + 1, '20:00') });
  const d = r.find(x => x.id === 'blk-dent-2026-10-22');
  assert.ok(d, 'el evento de Turbo genera su aviso');
  assert.equal(hora(d.at), '14:45');
  assert.equal(d.title, '📌 Dentista en 15 min');
});

// ---- Huecos libres (Sesión 3) ----
const huecosDe = r => r.filter(x => x.serie.startsWith('hueco-'));

test('hueco al salir de clase: avisa al salir y a los 10 min, con una tarea que cabe; tras un evento de Google, 5 min antes', () => {
  const r = plan({
    schedule: [
      { id: 'c1', title: 'Cálculo', kind: 'clase', days: [2], start: '08:30', end: '10:00' },
      { id: 'c2', title: 'Finanzas', kind: 'clase', days: [2], start: '10:00', end: '11:30' },
    ],
    tasks: [
      { id: 'larga', title: 'Informe entero', minutes: 120, due: '2026-10-20' },
      { id: 'cabe', title: 'Leer apunte', minutes: 25, due: '2026-10-21' },
    ],
  }, { eventos: [{ title: 'Almuerzo', date: '2026-10-20', start: '13:00', end: '14:00' }] });
  const h = huecosDe(r).filter(x => x.serie === 'hueco-2026-10-20-11:30');
  assert.deepEqual(h.map(x => hora(x.at)), ['11:30', '11:40'], 'en clase no suena: el primero llega al salir');
  assert.equal(h[0].title, '🕳️ Hueco de 1h 30min');
  assert.match(h[0].body, /hasta las 13:00/);
  assert.match(h[0].body, /Leer apunte \(25 min\)/, 'propone la que cabe, no la de 2 horas');
  assert.ok(h.every(x => x.url === '/#/ahora'));
  const tarde = huecosDe(r).filter(x => x.serie === 'hueco-2026-10-20-14:00');
  assert.deepEqual(tarde.map(x => hora(x.at)), ['13:55', '14:00', '14:10'], 'tras el almuerzo: 5 min antes, al empezar y a los 10 min');
  assert.equal(new Set(tarde.map(x => x.body)).size, 3, 'frases distintas');
  assert.ok(!huecosDe(r).some(x => x.serie.includes('10:00')), 'entre clases seguidas no hay hueco');
});

test('sin tareas que quepan, el aviso del hueco igual llega con otra frase', () => {
  const r = plan({ schedule: [{ id: 'c', title: 'Clase', kind: 'clase', days: [2], start: '08:30', end: '12:00' }, { id: 'd', title: 'Taller', kind: 'otro', days: [2], start: '12:40', end: '20:00' }] });
  const [primero] = huecosDe(r);
  assert.equal(hora(primero.at), '12:00');
  assert.match(primero.body, /40 min libres hasta las 12:40/);
});

test('el día sin nada anotado no avisa huecos (de eso se encargan los buenos días); el fin de semana vacío tampoco', () => {
  assert.deepEqual(huecosDe(plan({ schedule: [] }, { ahora: a(MAR, '07:00') })), []);
  const SAB = MAR + 4;
  assert.deepEqual(huecosDe(plan({ schedule: [] }, { ahora: a(SAB, '07:00') })), []);
});

test('fin de semana: solo avisa el hueco entre dos cosas anotadas', () => {
  const SAB = MAR + 4;
  const r = plan({ schedule: [] }, { ahora: a(SAB, '07:00'), eventos: [
    { title: 'Cumple', date: '2026-10-24', start: '13:00', end: '15:00' },
    { title: 'Cine', date: '2026-10-24', start: '17:00', end: '19:00' },
  ] });
  assert.deepEqual(huecosDe(r).map(x => x.serie), ['hueco-2026-10-24-15:00', 'hueco-2026-10-24-15:00', 'hueco-2026-10-24-15:00']);
});

test('como mucho 3 avisos por hueco y ninguno de noche', () => {
  const r = plan({ schedule: [{ id: 'p', title: 'Pega', kind: 'pega', days: [2], start: '08:30', end: '12:00' }, { id: 'd', title: 'Taller', kind: 'otro', days: [2], start: '12:30', end: '20:00' }] });
  const h = huecosDe(r);
  assert.deepEqual(h.map(x => hora(x.at)), ['11:55', '12:00', '12:10']);
  assert.ok(h.length <= MAX_POR_SERIE);
});

test('como mucho 3 huecos con aviso por día (más es ruido)', () => {
  const schedule = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'].map((t, i) => ({ id: `c${i}`, title: 'Reunión', kind: 'otro', days: [2], start: t, end: `${String(Number(t.slice(0, 2)) + 1).padStart(2, '0')}${t.slice(2)}` }));
  const series = new Set(huecosDe(plan({ schedule })).map(x => x.serie));
  assert.deepEqual([...series], ['hueco-2026-10-20-10:00', 'hueco-2026-10-20-11:30', 'hueco-2026-10-20-13:00']);
});

test('fin del descanso avisa con su texto y ofrece otra vuelta con los minutos que eligió', () => {
  const ahora = a(MAR, '10:00');
  const r = plan({ settings: { focoMin: 37 }, focus: { start: ahora, endAt: a(MAR, '10:10'), plannedMin: 10, descanso: true } }, { ahora });
  const f = r.find(x => x.url === '/#/foco');
  assert.equal(f.title, '☕ Fin del descanso');
  assert.equal(f.body, '¿Otra vuelta de 37 min?');
  assert.equal(hora(f.at), '10:10');
});
