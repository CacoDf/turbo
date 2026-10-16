// Detector de huecos (public/js/huecos.js): función pura que comparten la app y el cron.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { huecos, opcionesHueco } from '../../public/js/huecos.js';

const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ver = lista => lista.map(h => `${hm(h.ini)}-${hm(h.fin)} ${h.tipo}`);

test('día de semana vacío: un solo hueco largo de 08:30 a 20:00', () => {
  assert.deepEqual(ver(huecos([])), ['08:30-20:00 largo']);
});

test('clases seguidas o que se topan no dejan hueco entre ellas', () => {
  const r = huecos([
    { start: '08:10', end: '10:00' }, { start: '10:00', end: '11:30' }, // seguidas (antes de las 08:30 no cuenta)
    { start: '11:20', end: '13:00' }, // se topa con la anterior
    { start: '14:00', end: '15:30' },
  ]);
  assert.deepEqual(ver(r), ['13:00-14:00 medio', '15:30-20:00 largo']);
});

test('huecos de menos de 30 min no cuentan (ni los de 15 ni los de 29)', () => {
  const r = huecos([
    { start: '08:00', end: '09:00' }, { start: '09:15', end: '10:00' }, // 15 min
    { start: '10:29', end: '12:00' }, // 29 min
    { start: '12:30', end: '20:00' }, // 30 min justo: sí cuenta
  ]);
  assert.deepEqual(ver(r), ['12:00-12:30 medio']);
});

test('los eventos de todo el día no ocupan tiempo', () => {
  const r = huecos([{ title: 'Cumple', allDay: true }, { start: '09:00', end: '19:40' }]);
  assert.deepEqual(ver(r), ['08:30-09:00 medio']);
});

test('se recorta a la ventana: lo de antes de las 08:30 o después de las 20 no importa', () => {
  const r = huecos([{ start: '06:00', end: '08:40' }, { start: '19:10', end: '23:00' }, { start: '21:00', end: '22:00' }]);
  assert.deepEqual(ver(r), ['08:40-19:10 largo']);
});

test('60 min justos es medio; 61 es largo', () => {
  assert.deepEqual(ver(huecos([{ start: '09:30', end: '20:00' }])), ['08:30-09:30 medio']);
  assert.deepEqual(ver(huecos([{ start: '09:31', end: '20:00' }])), ['08:30-09:31 largo']);
});

test('acepta minutos del día y eventos que terminan a medianoche', () => {
  const r = huecos([{ ini: 8 * 60, fin: 12 * 60 }, { start: '18:00', end: '00:00' }]);
  assert.deepEqual(ver(r), ['12:00-18:00 largo']);
});

test('datos raros no rompen nada', () => {
  assert.deepEqual(ver(huecos([null, {}, { start: 'xx', end: '10:00' }, { start: '10:00' }])), ['08:30-20:00 largo']);
});

test('opciones del usuario, con valores de fábrica si vienen mal', () => {
  assert.deepEqual(opcionesHueco({ huecoDesde: '09:00', huecoHasta: '18:00', huecoMin: 45 }), { desde: 540, hasta: 1080, min: 45, soloEntre: false });
  assert.deepEqual(opcionesHueco({ huecoDesde: '20:00', huecoHasta: '08:00', huecoMin: 'x' }), { desde: 510, hasta: 1200, min: 30, soloEntre: false });
  const r = huecos([{ start: '10:00', end: '17:20' }], opcionesHueco({ huecoDesde: '09:00', huecoHasta: '18:00', huecoMin: 45 }));
  assert.deepEqual(ver(r), ['09:00-10:00 medio']);
});

test('fin de semana sin nada anotado: no hay huecos', () => {
  assert.deepEqual(huecos([], opcionesHueco({}, 6)), []);
  assert.deepEqual(huecos([{ title: 'Feriado', allDay: true }], opcionesHueco({}, 0)), []);
});

test('fin de semana: solo cuenta el tiempo entre dos cosas, no antes de la primera ni después de la última', () => {
  const r = huecos([{ start: '11:00', end: '12:00' }, { start: '13:30', end: '15:00' }, { start: '15:10', end: '16:00' }], opcionesHueco({}, 0));
  assert.deepEqual(ver(r), ['12:00-13:30 largo']);
  assert.deepEqual(huecos([{ start: '11:00', end: '12:00' }], opcionesHueco({}, 6)), [], 'una sola cosa no deja huecos');
});
