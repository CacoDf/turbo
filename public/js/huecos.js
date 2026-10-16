// Detector de huecos: el tiempo libre entre eventos, dentro de la ventana del día (08:30–20:00 por defecto).
// Sábado y domingo no hay ventana: solo cuenta el tiempo entre dos cosas anotadas.
// Es puro (sin DOM ni fechas): lo usan Día y Ahora en la app, y el cron del servidor para avisar.
export const HUECO = { desde: '08:30', hasta: '20:00', min: 30, largo: 60 };

const aMin = hm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Opciones del usuario (state.settings), con los valores de fábrica si faltan o vienen mal.
// dow (0 = domingo … 6 = sábado): el fin de semana solo cuentan los huecos entre cosas.
export function opcionesHueco(s = {}, dow = 1) {
  const desde = aMin(s.huecoDesde) ?? aMin(HUECO.desde);
  const hasta = aMin(s.huecoHasta) ?? aMin(HUECO.hasta);
  const min = Number(s.huecoMin) > 0 ? Number(s.huecoMin) : HUECO.min;
  if (dow === 0 || dow === 6) return { desde: 0, hasta: 24 * 60, min, soloEntre: true }; // fin de semana: cualquier hora, entre cosas
  return desde < hasta ? { desde, hasta, min, soloEntre: false } : { desde: aMin(HUECO.desde), hasta: aMin(HUECO.hasta), min, soloEntre: false };
}

// bloques: [{ini, fin}] en minutos del día, o [{start, end}] en 'HH:MM'. Los de todo el día no ocupan tiempo.
// Devuelve [{ini, fin, min, tipo}] con tipo 'medio' (hasta 60 min) o 'largo' (más de 60).
export function huecos(bloques = [], opciones = {}) {
  const { desde, hasta, min, soloEntre } = { ...opcionesHueco(), ...opciones };
  const ocupado = [];
  for (const b of bloques) {
    if (!b || b.allDay) continue;
    const ini = b.ini ?? aMin(b.start);
    let fin = b.fin ?? aMin(b.end);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin = 24 * 60; // termina a medianoche o después
    const a = Math.max(ini, desde);
    const z = Math.min(fin, hasta);
    if (z > a) ocupado.push([a, z]);
  }
  ocupado.sort((x, y) => x[0] - y[0]);

  const libres = [];
  let cursor = soloEntre ? null : desde; // sin ventana, el primer hueco parte cuando termina la primera cosa
  for (const [a, z] of ocupado) {
    if (cursor != null && a > cursor) libres.push([cursor, a]);
    cursor = Math.max(cursor ?? z, z); // eventos que se topan o van seguidos (clases seguidas) cuentan como uno
  }
  if (!soloEntre && hasta > cursor) libres.push([cursor, hasta]);

  return libres
    .map(([ini, fin]) => ({ ini, fin, min: fin - ini, tipo: fin - ini > HUECO.largo ? 'largo' : 'medio' }))
    .filter(h => h.min >= min);
}
