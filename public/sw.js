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
  /** @type {Record<string, unknown>} */
  let payload = { url: '/panel' }
  try {
    const data = event.data?.json()
    if (data && typeof data === 'object') {
      if (typeof data.title === 'string') title = data.title
      if (typeof data.body === 'string') body = data.body
      payload = { ...data }
      if (typeof data.url === 'string') payload.url = data.url
    }
  } catch {
    const t = event.data?.text()
    if (t) body = t
  }
  if (typeof payload.url !== 'string') payload.url = '/panel'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: payload,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  let url = '/panel'
  if (data.type === 'application_accepted') {
    url = '/marketplace'
  } else if (data.type === 'application_rejected') {
    url = '/moje-wnioski'
  } else if (data.type === 'new_application' && data.vehicle_id) {
    url = `/pojazd/${data.vehicle_id}`
  } else if (data.type === 'document_expiry') {
    url =
      typeof data.url === 'string' && data.url
        ? data.url
        : data.vehicle_id
          ? `/pojazd/${data.vehicle_id}`
          : '/panel'
  } else if (typeof data.url === 'string' && data.url) {
    url = data.url
  }

  const origin = self.location.origin
  const absoluteUrl = url.startsWith('http') ? url : `${origin}${url.startsWith('/') ? url : `/${url}`}`
  const navigatePath = url.startsWith('http')
    ? (() => {
        try {
          const u = new URL(url)
          return `${u.pathname}${u.search}`
        } catch {
          return '/panel'
        }
      })()
    : url.startsWith('/')
      ? url
      : `/${url}`

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          return Promise.resolve(client.focus()).then(() => {
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(navigatePath)
            }
            if (clients.openWindow) return clients.openWindow(absoluteUrl)
          })
        }
      }
      if (clients.openWindow) return clients.openWindow(absoluteUrl)
    })
  )
})
