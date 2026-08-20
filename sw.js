const APP_VERSION = '2026-08-19-financas-mobile-v1';
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

  // Documentos HTML sempre da rede (fallback ao cache offline) para
  // nunca servir páginas antigas com HTML novo parcial.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
    // JS/CSS: serve o cache quente imediatamente e revalida em
    // segundo plano; a revisão é o APP_VERSION (limpeza no activate).
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.destination === 'manifest' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isSameOrigin(request)) {
    const destination = request.destination;
    if (destination === 'image' || destination === 'font' || destination === 'audio' || destination === 'video') {
      // Assets imutáveis e mídia: cache-first com fallback à rede.
      event.respondWith(cacheFirst(request));
      return;
    }
    if (isPrecached(request)) {
      event.respondWith(cacheFirst(request));
      return;
    }
  }
});

function isHttpRequest(request) {
  return request.url.startsWith('http://') || request.url.startsWith('https://');
}

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (_) {
    return false;
  }
}

function isPrecached(request) {
  try {
    const url = new URL(request.url);
    return PRECACHE_URLS.some((p) => {
      if (p === url.pathname) return true;
      if (url.pathname.endsWith(p)) return true;
      return false;
    });
  } catch (_) {
    return false;
  }
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = (async () => {
    try {
      const freshRequest = new Request(request, { cache: 'no-store' });
      const response = await fetch(freshRequest);
      if (response && response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })();

  if (cached) {
    return cached;
  }
  return fetchPromise;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const freshRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(freshRequest);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}
