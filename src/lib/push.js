import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    return registration
  } catch (e) {
    console.warn('[Cario] Service worker', e)
    return null
  }
}

/**
 * @param {string} userId
 */
export async function savePushSubscription(userId, subscription) {
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const key = json.keys
  if (!endpoint || !key?.p256dh || !key?.auth) return

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      subscription: JSON.stringify(json),
      updated_at: new Date().toISOString(),
      endpoint,
      p256dh: key.p256dh,
      auth: key.auth,
    },
    { onConflict: 'user_id' }
  )
  if (error) console.error('[Cario] push_subscriptions', error)
}

/**
 * @param {string} userId
 * @returns {Promise<PushSubscription | null>}
 */
export async function subscribeToPush(user) {
  try {
    if (!user?.id) return null

    if (!('Notification' in window)) {
      console.log('Notifications not supported')
      return null
    }
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported')
      return null
    }

    await registerServiceWorker()
    console.log('1. Checking notification permission:', Notification.permission)
    console.log('2. Service worker registration:', await navigator.serviceWorker.getRegistration())
    console.log('3. VAPID key:', import.meta.env.VITE_VAPID_PUBLIC_KEY ? 'EXISTS' : 'MISSING')

    const permission =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    console.log('Permission result:', permission)
    if (permission !== 'granted') return null

    const registration = await navigator.serviceWorker.ready
    console.log('Service worker ready:', registration)

    let subscription = await registration.pushManager.getSubscription()
    console.log('Existing subscription:', subscription)

    if (!subscription) {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn('[Cario] Brak VITE_VAPID_PUBLIC_KEY — pomijam Web Push')
        return null
      }
      console.log('Creating subscription with VAPID key:', `${vapidKey.substring(0, 20)}...`)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      console.log('New subscription created:', subscription)
    }

    await savePushSubscription(user.id, subscription)
    console.log('Subscription saved to database!')
    return subscription
  } catch (err) {
    console.error('Push subscription error:', err)
    return null
  }
}

/**
 * @deprecated Backward-compat alias
 */
export async function subscribeUserToPush(userId) {
  return subscribeToPush({ id: userId })
}
