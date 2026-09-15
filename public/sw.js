const CACHE = 'thermal-guard-v22'
const CORE = ['./', './index.html', './mobile-app.html', './user-app.html', './mobile-install.html', './app-access.html', './privacy.html', './support.html', './thermal-guard.mobileconfig', './demo-live.gif', './manifest.webmanifest', './manifest-system.webmanifest', './manifest-user.webmanifest', './apple-touch-icon.png', './apple-touch-icon-user.png', './icon-192.png', './icon-512.png', './icon-user-192.png', './icon-user-512.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  // 独立子应用（/user/、/system/）由各自的 Service Worker 负责，根 SW 不拦截，避免互相干扰
  try {
    const p = new URL(event.request.url).pathname
    if (p.includes('/user/') || p.includes('/system/')) return
  } catch {}

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
      .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  )
})
