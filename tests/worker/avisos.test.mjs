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

test('bloque propio y evento de Google avisan 15 min antes; si empiezan a la misma hora, un solo aviso', () => {
  const r = plan({ schedule: [{ id: 'gym', title: 'Gym', kind: 'entreno', days: [2], start: '18:00', end: '19:30' }] }, {
    eventos: [
      { title: 'Dentista', date: '2026-10-20', start: '16:00', end: '17:00', allDay: false },
      { title: 'Gym (Google)', date: '2026-10-20', start: '18:00', end: '19:30', allDay: false },
      { title: 'Cumple', date: '2026-10-20', allDay: true },
    ],
  });
  const gym = r.find(x => x.id === 'blk-gym-2026-10-20');
  assert.equal(hora(gym.at), '17:45');
  assert.equal(gym.title, '🏋️ Gym en 15 min');
  const dentista = r.find(x => x.title.startsWith('📅 Dentista'));
  assert.equal(hora(dentista.at), '15:45');
  assert.equal(dentista.url, '/#/ahora');
  assert.ok(!r.some(x => /Gym \(Google\)|Cumple/.test(x.title)), 'sin duplicado ni eventos de todo el día');
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
  assert.equal(hora(r.find(x => x.title.startsWith('📅 Reunión')).at), '11:30');
  assert.ok(!r.some(x => x.title.includes('Llamada')), 'avisar de la llamada después de que empezó no sirve');
  const catedra = r.find(x => x.title.includes('Cátedra'));
  assert.ok(catedra.title.startsWith('🎓'), 'un evento de Google que dice cátedra cuenta como clase');
  const r2 = plan({ settings: { habitsAt: '12:30' }, habits: [{ id: 'h1', name: 'Agua', target: 1 }] }, {
    eventos: [{ title: 'Cátedra Finanzas', date: '2026-10-20', start: '12:00', end: '13:30' }, { title: 'Almuerzo', date: '2026-10-20', start: '12:15', end: '12:45' }],
  });
  assert.equal(hora(r2.find(x => x.id === 'habitos-2026-10-20').at), '13:30', 'silencio en la cátedra, no en cualquier evento');
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
  const m = r.find(x => x.id === 'minimo-2026-10-20');
  assert.equal(m.title, '🌱 Día mínimo');
  assert.equal(m.url, '/?minimo=1#/ahora');
  assert.match(m.body, /2 minutos/);
  assert.doesNotMatch(m.body, /días sin|no abriste|abandon/i, 'sin culpa');
  assert.ok(!r.some(x => x.id === 'manana-2026-10-20'));
  const r2 = plan({}, { visto: ahora - 1 * 86400000 });
  assert.ok(r2.some(x => x.id === 'manana-2026-10-20') && !r2.some(x => x.serie.startsWith('minimo')));
  const r3 = plan({}, { visto: ahora - 2.5 * 86400000 });
  assert.ok(r3.some(x => x.id === 'manana-2026-10-20') && r3.some(x => x.id === 'minimo-2026-10-21'), 'mañana ya serían 3 días');
  assert.ok(plan({}, { visto: null }).some(x => x.id === 'manana-2026-10-20'), 'sin dato de apertura: normal');
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
  assert.equal(f.id, `foco-${ahora}`);
  assert.equal(f.title, '🏁 ¡Tiempo!');
  assert.equal(hora(f.at), '01:00');
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
