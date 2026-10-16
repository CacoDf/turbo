// Fechas y horas "de pared" en Chile. El servidor corre en UTC; Joaquín vive en America/Santiago (con cambio de horario).

export const TZ = 'America/Santiago';
export const pad = n => String(n).padStart(2, '0');

// Fecha y hora "de pared" en Chile para un instante dado.
// El formateador se crea una sola vez: crearlo es caro y el plan gratis da ~10 ms de CPU.
let santiagoFmt = null;
export function santiagoParts(date = new Date()) {
  santiagoFmt = santiagoFmt || new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = {};
  for (const x of santiagoFmt.formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
}

// Días "de pared" como enteros (días desde 1970) para operar sin husos horarios.
export const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
export const fromDayNum = n => { const x = new Date(n * 86400000); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() }; };
export const keyOf = n => { const x = fromDayNum(n); return `${x.y}-${pad(x.m)}-${pad(x.d)}`; };
export const keyToNum = k => { const [y, m, d] = k.split('-').map(Number); return dayNum(y, m, d); };
export const hmToMin = hm => { const [h, m] = String(hm || '00:00').split(':').map(Number); return h * 60 + (m || 0); };

// Instante → { dia, min } de pared en Chile. Con memoria por minuto: el cron lo pide muchas veces
// por los mismos instantes y cada formateo cuesta CPU (el plan gratis da ~10 ms).
const memo = new Map();
export function enChile(t) {
  const k = Math.floor(t / 60000);
  let x = memo.get(k);
  if (!x) {
    const p = santiagoParts(new Date(k * 60000));
    x = { dia: dayNum(p.y, p.m, p.d), min: p.hh * 60 + p.mm };
    if (memo.size > 5000) memo.clear();
    memo.set(k, x);
  }
  return x;
}

// Día y minuto de pared en Chile → instante (ms UTC). Corrige el desfase (-3 o -4 h) en dos vueltas.
export function instante(dia, min) {
  const pared = dia * 86400000 + min * 60000;
  let t = pared + 4 * 3600000;
  for (let i = 0; i < 2; i++) {
    const x = enChile(t);
    t += pared - (x.dia * 86400000 + x.min * 60000);
  }
  return t;
}
