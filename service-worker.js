// service-worker.js
const VERSION = 'v1.2.6';
const STATIC = `static-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo mismo origen
  if (url.origin !== location.origin) return;

  // Navegación: cache -> red; y fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) =>
        cached ||
        fetch(req).catch(
          () =>
            new Response(
              '<!doctype html><meta charset="utf-8"><title>Apolo</title><body style="font-family:system-ui;background:#0b0b0c;color:#eee;padding:2rem"><h1>Apolo</h1><p>Estás sin conexión.</p></body>',
              { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
            )
        )
      )
    );
    return;
  }

  // Estáticos: cache-first con actualización en segundo plano
  if (/\.(png|jpg|jpeg|svg|webp|ico|css|js|json)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});