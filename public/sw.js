// Service worker do Pesca Joinville: funciona offline e mostra os avisos (Web Push).
const CACHE = 'pesca-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Arquivos do app (com hash no nome): cache primeiro. Páginas: rede primeiro, cache se offline.
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
    })));
  } else if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res;
    }).catch(() => caches.match('/')));
  }
});

// O servidor manda o aviso já com título e texto (JSON). Se vier vazio, busca o último aviso.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let msg = null;
    try { msg = e.data ? e.data.json() : null; } catch (_) { msg = null; }
    if (!msg) {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        const r = await fetch('/api/push/last?endpoint=' + encodeURIComponent(sub ? sub.endpoint : ''));
        if (r.ok) msg = await r.json();
      } catch (_) { /* sem rede */ }
    }
    if (!msg || !msg.title) msg = { title: 'Pesca Joinville', body: 'A previsão de pesca foi atualizada. Toque para ver.' };
    await self.registration.showNotification(msg.title, {
      body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'pesca-' + (msg.date || 'aviso'), data: { url: '/' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => 'focus' in x);
    return w ? w.focus() : self.clients.openWindow('/');
  }));
});
