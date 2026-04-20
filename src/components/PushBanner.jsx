import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { registerServiceWorker, subscribeToPush } from '../lib/push'

const STORAGE_KEY = 'flota_push_prompt_done_v1'

export function PushBanner() {
  const { t } = useTranslation()
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
      await subscribeToPush(user)
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
    <div className="push-banner" role="region" aria-label={t('push.regionAria')}>
      <div className="push-banner-inner">
        <span className="push-banner-text">{t('push.text')}</span>
        <div className="push-banner-actions">
          <button type="button" className="btn primary small" disabled={busy} onClick={enable}>
            {busy ? t('push.busy') : '🔔 Включити сповіщення'}
          </button>
          <button type="button" className="btn ghost small" onClick={skip}>
            {t('push.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
