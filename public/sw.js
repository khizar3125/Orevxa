/* Orvexa Studio service worker — offline shell + safe update flow. */
const ORVEXA_SW_VERSION = '10.0.0';
const CACHE_VERSION = `orvexa-static-v${ORVEXA_SW_VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './play.html',
  './modeler.html',
  './manifest.webmanifest',
  './orvexa-mark.svg',
  './icons/orvexa-192.png',
  './icons/orvexa-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch { /* A missing optional route must not fail the whole install. */ }
    }));
    // First install activates immediately; updates wait for the user's choice.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('orvexa-static-') && key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isStaticAsset(url.pathname)) event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    return new Response('Orvexa Studio is offline and this page is not cached yet. Reconnect and reload.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || new Response('Asset unavailable offline.', { status: 503 });
}

function isStaticAsset(pathname) {
  return /\.(?:js|mjs|css|svg|png|jpe?g|webp|gif|woff2?|ttf|otf|json|webmanifest|txt)$/i.test(pathname);
}
