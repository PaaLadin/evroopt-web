// Мой кошык — service worker (offline-first)
const CACHE = 'koshik-v1';
const ASSETS = [
  './',
  './index.html',
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

  // Supabase REST/Auth — network-only, кэш не нужен (свежие данные)
  if (url.hostname.endsWith('.supabase.co')) return;

  // same-origin: cache-first для статики, network-fallback
  if (url.origin === self.location.origin) {
    ev.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  }
});