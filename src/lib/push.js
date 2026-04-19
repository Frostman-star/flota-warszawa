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
    return await navigator.serviceWorker.register('/sw.js')
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
      endpoint,
      p256dh: key.p256dh,
      auth: key.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) console.error('[Cario] push_subscriptions', error)
}

/**
 * @param {string} userId
 * @returns {Promise<PushSubscription | null>}
 */
export async function subscribeUserToPush(userId) {
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapid) {
    console.warn('[Cario] Brak VITE_VAPID_PUBLIC_KEY — pomijam Web Push')
    return null
  }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  })
  await savePushSubscription(userId, sub)
  return sub
}
