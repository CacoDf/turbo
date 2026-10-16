// Push con contenido: Declarative Web Push (iOS 18.4+) cifrado según RFC 8291 (aes128gcm).
// El iPhone lo muestra solo, sin despertar al service worker; otros navegadores se lo pasan al service worker (respaldo).

const enc = new TextEncoder();

export const b64urlBytes = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(s).length % 4)) % 4)), c => c.charCodeAt(0));

function unir(...partes) {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

export const tieneClaves = sub => !!(sub?.keys?.p256dh && sub?.keys?.auth);

// Cifra el texto para una suscripción (claves p256dh y auth del navegador). Devuelve el cuerpo listo para mandar.
export async function cifrar(texto, { p256dh, auth }) {
  const uaPub = b64urlBytes(p256dh);
  const par = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, par.privateKey, 256));
  const ikm = await hkdf(b64urlBytes(auth), compartido, unir(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Un solo registro: el texto + el delimitador 0x02 (último registro).
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, unir(enc.encode(texto), new Uint8Array([2]))));
  const cabecera = new Uint8Array(21 + asPub.length);
  cabecera.set(salt);
  new DataView(cabecera.buffer).setUint32(16, 4096);
  cabecera[20] = asPub.length;
  cabecera.set(asPub, 21);
  return unir(cabecera, cifrado);
}

// Mensaje declarativo: el iPhone muestra title/body, abre "navigate" al tocarlo y pone el número del ícono.
export function mensajeDeclarativo({ title, body, url, tag, badge }, origin) {
  const msg = {
    web_push: 8030,
    notification: { title: String(title).slice(0, 120), body: String(body || '').slice(0, 300), navigate: new URL(url || '/', origin).href, lang: 'es-CL', dir: 'ltr' },
  };
  if (tag) msg.notification.tag = String(tag).slice(0, 80);
  if (Number.isInteger(badge) && badge >= 0) msg.app_badge = badge;
  return JSON.stringify(msg);
}
