/**
 * Embrollado app-shell service worker.
 *
 * Precaches the built assets (the hashed files under /assets/ plus index.html and the manifest),
 * serves the app shell from the cache when the network is unavailable, and never touches the
 * learner's AI service origin.
 *
 * Version constant: bump it (or it changes because asset hashes changed) and the activate step
 * deletes the old caches. Activated workers do NOT skip waiting, so a running session is never
 * interrupted mid-turn; the new version takes over on the next load.
 */
const VERSION = 'embrollado-v1'
const CACHE_NAME = `${VERSION}-shell`

// Files added at build time. `self.__prerendered` is not used; instead we cache on install by
// fetching the root document and letting runtime caching pick up the hashed assets.
const SHELL = ['index.html', 'manifest.webmanifest', 'favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      for (const file of SHELL) {
        const url = new URL(file, self.registration.scope)
        try {
          const res = await fetch(url, { cache: 'reload' })
          if (res.ok) await cache.put(url, res)
        } catch {
          /* first install may happen offline; the shell is not critical to survival */
        }
      }
      // Cache the app's own hashed assets so the shell is complete.
      try {
        const root = await fetch(new URL('./', self.registration.scope), { cache: 'reload' })
        const html = await root.text()
        const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
          .map((m) => m[1])
          .filter((p) => p.includes('/assets/'))
        for (const a of assets) {
          const url = new URL(a, self.registration.scope)
          const res = await fetch(url)
          if (res.ok) await cache.put(url, res)
        }
      } catch {
        /* offline install — the next online visit completes the cache */
      }
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

// Network-first for the document, cache-first (stale-while-revalidate) for hashed assets,
// and never intercept the AI service (different origin anyway).
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request)
          if (res.ok) {
            const cache = await caches.open(CACHE_NAME)
            cache.put(request.url, res.clone())
            return res
          }
          throw new Error('offline or server error')
        } catch {
          const cached = await caches.match(request.url)
          if (cached) return cached
          const fallback = await caches.match('./index.html')
          if (fallback) return fallback
          return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
        }
      })(),
    )
    return
  }

  const isHashedAsset = /\.(?:js|css|woff2|png|webp|svg)$/.test(url.pathname)
  if (isHashedAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(request.url, res.clone())
        }
        return res
      })(),
    )
  }
})
