// Lectura de notas sin IA (localParse en public/js/planner.js): qué queda como tarea y qué como evento con hora.
// Corre en node con un reloj fijo (martes 20-oct-2026 10:00) y sin navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.window = { addEventListener() {} };
globalThis.document = {};
const Real = Date;
const FIJO = new Real(2026, 9, 20, 10, 0, 0).getTime();
globalThis.Date = class extends Real {
  constructor(...a) { super(...(a.length ? a : [FIJO])); }
  static now() { return FIJO; }
};
const { localParse } = await import('../../public/js/planner.js');

const ev = (title, date, start, end) => ({ kind: 'evento', title, date, start, end });
const uno = texto => { const r = localParse(texto); assert.equal(r.length, 1, `${texto}: ${JSON.stringify(r)}`); return r[0]; };

test('con hora es evento, con título limpio y la fecha correcta', () => {
  const casos = [
    ['dentista jueves 15:00', ev('Dentista', '2026-10-22', '15:00', '16:00')],
    ['reunión miércoles 10:30', ev('Reunión', '2026-10-21', '10:30', '11:30')],
    ['gym sábado 7pm', ev('Gym', '2026-10-24', '19:00', '20:00')],
    ['dentista el jueves 15:00 hrs', ev('Dentista', '2026-10-22', '15:00', '16:00')],
    ['15:00 dentista', ev('Dentista', '2026-10-20', '15:00', '16:00')],
    ['llamar 20:00h', ev('Llamar', '2026-10-20', '20:00', '21:00')],
    ['a las 15.30 café', ev('Café', '2026-10-20', '15:30', '16:30')],
    // "a las 3" sin más es en la tarde; "de la mañana" es hora, no el día siguiente.
    ['llamar a las 3', ev('Llamar', '2026-10-20', '15:00', '16:00')],
    ['reunión a las 3 de la tarde', ev('Reunión', '2026-10-20', '15:00', '16:00')],
    ['carrete a las 11 de la noche', ev('Carrete', '2026-10-20', '23:00', '23:59')],
    ['gym a las 8 y media', ev('Gym', '2026-10-21', '08:30', '09:30')], // las 8:30 ya pasaron hoy
    ['dentista jueves a las 10 de la mañana', ev('Dentista', '2026-10-22', '10:00', '11:00')],
    // Rangos: el fin es el escrito.
    ['dentista 15:00 - 16:30', ev('Dentista', '2026-10-20', '15:00', '16:30')],
    ['clase 8:30 a 10:00', ev('Clase', '2026-10-21', '08:30', '10:00')],
    ['prueba el 3 a las 10', ev('Prueba', '2026-11-03', '10:00', '11:00')],
  ];
  for (const [texto, esperado] of casos) assert.deepEqual(uno(texto), esperado, texto);
});

test('duraciones, cantidades y fechas con punto siguen siendo tareas', () => {
  for (const [texto, minutos] of [['estudiar 2h', 120], ['arreglar bici 1h', 60], ['dormir 8 hrs', 480], ['estudiar 3 horas', 180], ['pagar 2 cuentas', 25], ['leer cap 3', 25], ['comprar 1.5 kg', 25], ['entrega 12.11', 25], ['versión 2.10 del informe', 25]]) {
    const r = uno(texto);
    assert.equal(r.kind, undefined, `${texto} no es evento`);
    assert.equal(r.minutes, minutos, texto);
  }
  assert.deepEqual(uno('1.- comprar pan').title, 'Comprar pan');
  assert.deepEqual(uno('prueba 12/11'), { title: 'Prueba', area: 'estudios', minutes: 25, due: '2026-11-12' });
  assert.equal(uno('pagar la cuenta hoy').title, 'Pagar la cuenta');
});

test('el dictado en una sola línea con comas se separa en cada cosa', () => {
  const r = localParse('pagar luz, dentista jueves 15:00, estudiar cálculo mañana 2 horas, almuerzo con la Caro a las 13');
  assert.equal(r.length, 4);
  assert.equal(r[0].title, 'Pagar luz');
  assert.deepEqual(r[1], ev('Dentista', '2026-10-22', '15:00', '16:00'));
  assert.deepEqual([r[2].title, r[2].due, r[2].minutes], ['Estudiar cálculo 2 horas', '2026-10-21', 120]);
  assert.deepEqual(r[3], ev('Almuerzo con la Caro', '2026-10-20', '13:00', '14:00'));
});

test('Atajo sin IA: "mañana" y "a las 9" se cuentan desde que se dictó, no desde que se abre la app', () => {
  const dictado = new Real(2026, 9, 19, 23, 0); // lunes 23:00; la app se abre el martes a las 10:00
  assert.deepEqual(localParse('dentista mañana a las 10', dictado)[0], ev('Dentista', '2026-10-20', '10:00', '11:00'));
  const temprano = new Real(2026, 9, 20, 8, 0); // dictado a las 08:00, abierto a las 10:00
  assert.deepEqual(localParse('reunión a las 9', temprano)[0], ev('Reunión', '2026-10-20', '09:00', '10:00'));
});
