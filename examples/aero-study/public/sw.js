/**
 * AeroStudy service worker (hand-rolled, no libraries).
 * - Precache the app shell on install.
 * - Cache-first for hashed build assets; network-first with cache fallback
 *   for navigations and study data, so offline opens read-only.
 */

const SHELL_CACHE = 'aerostudy-shell-v1'
const DATA_CACHE = 'aerostudy-data-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // Hashed build assets: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request)
        if (hit) return hit
        const res = await fetch(event.request)
        if (res.ok) cache.put(event.request, res.clone())
        return res
      }),
    )
    return
  }

  // Study data: network-first, cached copy when offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          const hit = await cache.match(event.request)
          if (hit) return hit
          throw new Error('offline and no cached data')
        }
      }),
    )
    return
  }

  // Navigations / shell: network-first, shell fallback offline.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      try {
        const res = await fetch(event.request)
        if (res.ok) cache.put(event.request, res.clone())
        return res
      } catch {
        return (await cache.match(event.request)) ?? (await cache.match('/index.html'))
      }
    }),
  )
})
