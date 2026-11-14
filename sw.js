// Мой кошык — service worker (network-first для HTML, cache-first для статики)
const CACHE = 'koshik-v3';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase REST/Auth — network-only
  if (url.hostname.endsWith('.supabase.co')) return;

  // Только same-origin
  if (url.origin !== self.location.origin) return;

  // HTML-навигация — NETWORK-FIRST (важно: при обновлении index.html пользователь получает свежее)
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html') || url.pathname.endsWith('.html') || url.pathname === '/';
  if (isHtml) {
    ev.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // sw.js — всегда network-only (иначе браузер залипнет на старом SW)
  if (url.pathname.endsWith('/sw.js')) {
    ev.respondWith(fetch(req));
    return;
  }

  // Статика (иконки, manifest) — CACHE-FIRST
  ev.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return resp;
    }))
  );
});
