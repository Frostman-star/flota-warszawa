/* Cario — service worker (push + cache) */
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let title = 'Cario'
  let body = 'Nowe przypomnienie o dokumencie.'
  let url = '/panel'
  try {
    const data = event.data?.json()
    if (data?.title) title = data.title
    if (data?.body) body = data.body
    if (data?.url) url = data.url
  } catch {
    const t = event.data?.text()
    if (t) body = t
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification?.data?.url || '/panel'
  event.waitUntil(self.clients.openWindow(url))
})
