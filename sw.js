const CACHE_NAME = 'preromaneio-cache-v1';
const urlsToCache = [
  './preromaneio.html',
  './menu.css',
  './romaneio-comum.css',
  './print-styles.css',
  './menu-component.js',
  './preromaneio.js',
  './preromaneio-modals.js',
  './fornecedor-modals.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
