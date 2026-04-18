import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { registerServiceWorker, subscribeUserToPush } from '../lib/push'

const STORAGE_KEY = 'flota_push_prompt_done_v1'

export function PushBanner() {
  const { session, user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  if (!session || !user?.id || dismissed) return null
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return null
  if (Notification.permission !== 'default') return null

  async function enable() {
    setBusy(true)
    try {
      await registerServiceWorker()
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        await subscribeUserToPush(user.id)
      }
    } catch (e) {
      console.warn(e)
    } finally {
      localStorage.setItem(STORAGE_KEY, '1')
      setDismissed(true)
      setBusy(false)
    }
  }

  function skip() {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="push-banner" role="region" aria-label="Powiadomienia push">
      <div className="push-banner-inner">
        <span className="push-banner-text">Włączyć powiadomienia o terminach dokumentów?</span>
        <div className="push-banner-actions">
          <button type="button" className="btn primary small" disabled={busy} onClick={enable}>
            {busy ? '…' : 'Włącz'}
          </button>
          <button type="button" className="btn ghost small" onClick={skip}>
            Później
          </button>
        </div>
      </div>
    </div>
  )
}
