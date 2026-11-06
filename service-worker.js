const CACHE = 'apolo-shell-__VERSION__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Wait for old tabs to close to avoid mixing versions.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => (k.startsWith('apolo-shell-') || k === 'static-v1.2.6') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const scope = new URL('./', self.location.href);
  if (!ASSETS.some(path => new URL(path, scope).href === url.href) && req.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') return await cache.match(new URL('./index.html', scope).href) || fetch(req);
    // These are public, content-hashed static files. Dev/preview servers may
    // vary on Origin, while module requests add Origin after precaching.
    return await cache.match(req, {ignoreVary:true}) || fetch(req);
  })());
});
