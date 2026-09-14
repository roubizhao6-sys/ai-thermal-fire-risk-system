const CACHE = 'thermal-guard-v6'
const CORE = ['./', './index.html', './mobile-app.html', './mobile-install.html', './thermal-guard.mobileconfig', './demo-live.gif', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.endsWith('/thermal-guard.mobileconfig')) {
    event.respondWith((async () => {
      const response = await fetch(event.request)
      const body = await response.blob()
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
          'Content-Disposition': 'inline; filename="thermal-guard.mobileconfig"',
          'Cache-Control': 'no-store'
        }
      })
    })())
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
