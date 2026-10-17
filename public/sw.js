// Service worker: permite abrir Turbo sin internet y recibir notificaciones.
const CACHE = 'turbo-v14';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/main.js', '/js/store.js', '/js/util.js', '/js/game.js', '/js/planner.js', '/js/api.js', '/js/ui.js', '/js/router.js', '/js/actions.js', '/js/huecos.js', '/js/bandeja.js',
  '/js/views/home.js', '/js/views/focus.js', '/js/views/capture.js', '/js/views/tasks.js', '/js/views/habits.js',
  '/js/views/day.js', '/js/views/garage.js', '/js/views/settings.js',
  '/js/views/goals.js', '/js/views/review.js', '/js/calendar.js',
  '/js/views/routines.js', '/js/views/mood.js', '/js/views/studies.js',
  '/puente-google.txt', '/icons/icon-192.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Primero la red (así siempre tienes la última versión); si no hay internet, lo guardado.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});

// A dónde lleva cada tipo de aviso al tocarlo.
function urlForTag(tag) {
  tag = tag || '';
  if (tag.startsWith('morning')) return '/#/capturar';
  if (tag.startsWith('review')) return '/#/revision';
  if (tag.startsWith('habits')) return '/#/habitos';
  if (tag.startsWith('rt-')) return '/#/rutinas';
  if (tag.startsWith('exam')) return '/#/estudios';
  if (tag === 'focus-end') return '/#/foco';
  return '/';
}

// Respaldo del push declarativo: el iPhone (iOS 18.4+) muestra solo el aviso sin pasar por aquí.
// Otros navegadores entregan el mismo JSON a este service worker, que lo muestra igual.
// Suscripciones antiguas reciben un push vacío: se piden los mensajes pendientes al servidor.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let data = null;
    try { data = e.data?.json(); } catch {}
    if (data?.web_push === 8030 && data.notification) {
      const n = data.notification;
      if (Number.isInteger(data.app_badge) && self.navigator.setAppBadge) {
        await (data.app_badge ? self.navigator.setAppBadge(data.app_badge) : self.navigator.clearAppBadge()).catch(() => {});
      }
      return self.registration.showNotification(n.title, {
        body: n.body, tag: n.tag || undefined, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: n.navigate || '/' },
      });
    }
    let messages = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const res = await fetch(`/api/push/pending?endpoint=${encodeURIComponent(sub.endpoint)}`);
      messages = (await res.json()).messages || [];
    } catch {}
    if (!messages.length) messages = [{ title: 'Turbo', body: 'Tienes algo pendiente. Toca para ver.' }];
    await Promise.all(messages.map(m => self.registration.showNotification(m.title, {
      body: m.body,
      tag: m.tag || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: m.url || urlForTag(m.tag) },
    })));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => new URL(c.url).origin === location.origin);
    if (open) {
      await open.focus();
      return open.navigate?.(target);
    }
    return self.clients.openWindow(target);
  })());
});
