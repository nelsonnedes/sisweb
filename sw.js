const APP_VERSION = '2026-06-26-boleto-pix-lamina-v3';
const CACHE_NAME = `sisweb-runtime-${APP_VERSION}`;
const PRECACHE_URLS = [
  '/manifest.json',
  '/assets/vendor/jspdf.umd.min.js',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        console.warn('[SW] Falha ao preparar cache PWA:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SISWEB_PWA_UPDATED', version: APP_VERSION, cacheName: CACHE_NAME });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: APP_VERSION, cacheName: CACHE_NAME });
    }
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET' || !isHttpRequest(request)) {
    return;
  }

  if (request.mode === 'navigate' || shouldUseNetworkFirst(request)) {
    event.respondWith(networkFirst(request));
  }
});

function isHttpRequest(request) {
  return request.url.startsWith('http://') || request.url.startsWith('https://');
}

function shouldUseNetworkFirst(request) {
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    return false;
  }

  const destination = request.destination;
  return destination === 'document'
    || destination === 'script'
    || destination === 'style'
    || destination === 'worker'
    || destination === 'manifest';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const freshRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(freshRequest);

    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}
