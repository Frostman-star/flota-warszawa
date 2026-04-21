import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function PwaUpdateBanner() {
  const { t } = useTranslation()
  const [waitingWorker, setWaitingWorker] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    let mounted = true
    let trackedReg = null

    const onControllerChange = () => {
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker.ready
      .then((reg) => {
        if (!mounted) return
        trackedReg = reg
        if (reg.waiting) setWaitingWorker(reg.waiting)
        const onUpdateFound = () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker)
            }
          })
        }
        reg.addEventListener('updatefound', onUpdateFound)
      })
      .catch(() => {})

    return () => {
      mounted = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      if (trackedReg) trackedReg.onupdatefound = null
    }
  }, [])

  if (!waitingWorker) return null

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span>{t('pwaInstall.update.available')}</span>
      <button
        type="button"
        className="btn primary small"
        onClick={() => {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' })
        }}
      >
        {t('pwaInstall.update.action')}
      </button>
    </div>
  )
}
