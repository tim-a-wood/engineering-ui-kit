const SHELL_CACHE = 'aerocalc-shell-v2';
const DATA_CACHE = 'aerocalc-data-v1';
const CORE_SHELL = ['/index.html', '/manifest.webmanifest', '/icon.svg'];

async function precacheBuiltShell() {
  const cache = await caches.open(SHELL_CACHE);
  const indexResponse = await fetch('/index.html', { cache: 'no-store' });
  if (!indexResponse.ok) throw new Error('App shell index could not be fetched.');
  const html = await indexResponse.clone().text();
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith('/') && !url.startsWith('/api/'));
  await cache.put('/index.html', indexResponse);
  await cache.addAll([...new Set([...CORE_SHELL.slice(1), ...assetUrls])]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheBuiltShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key))))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && url.pathname === '/api/snapshot') {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'Offline data is unavailable until the app has synced once.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/index.html')))
  );
});
