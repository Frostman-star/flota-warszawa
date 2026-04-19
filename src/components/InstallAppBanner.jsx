import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CARIO_INSTALL_DISMISSED_KEY,
  getIsPwaInstalled,
  isAndroidUserAgent,
  isInstallBannerDismissedInStorage,
  isIosUserAgent,
  isMobileViewportWidth,
} from '../utils/pwaInstallDetection'

export function InstallAppBanner({ navVariant = 'admin' }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => isInstallBannerDismissedInStorage())
  const [hiddenAfterInstallPrompt, setHiddenAfterInstallPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [mobile, setMobile] = useState(false)
  const [installed, setInstalled] = useState(true)

  const computeVisibility = useCallback(() => {
    setInstalled(getIsPwaInstalled())
    setMobile(isMobileViewportWidth())
  }, [])

  useEffect(() => {
    computeVisibility()
    window.addEventListener('resize', computeVisibility)
    return () => window.removeEventListener('resize', computeVisibility)
  }, [computeVisibility])

  useEffect(() => {
    const onBip = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const show =
    mobile &&
    !installed &&
    !dismissed &&
    !hiddenAfterInstallPrompt &&
    typeof document !== 'undefined'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    if (show) {
      el.classList.add('has-install-app-banner')
      el.dataset.installBannerNav = navVariant
    } else {
      el.classList.remove('has-install-app-banner')
      delete el.dataset.installBannerNav
    }
    return () => {
      el.classList.remove('has-install-app-banner')
      delete el.dataset.installBannerNav
    }
  }, [show, navVariant])

  const subtitleKey = deferredPrompt
    ? 'pwaInstall.banner.subtitlePrompt'
    : isIosUserAgent()
      ? 'pwaInstall.banner.subtitleIos'
      : isAndroidUserAgent()
        ? 'pwaInstall.banner.subtitleAndroid'
        : 'pwaInstall.banner.subtitleAndroid'

  function onDismiss() {
    try {
      localStorage.setItem(CARIO_INSTALL_DISMISSED_KEY, 'true')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  async function onInstallClick() {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } catch (e) {
      console.warn('[pwa install]', e)
    } finally {
      setDeferredPrompt(null)
      setHiddenAfterInstallPrompt(true)
    }
  }

  if (!show) return null

  return (
    <div
      className={`install-app-banner install-app-banner--nav-${navVariant}`}
      role="region"
      aria-label={t('pwaInstall.banner.regionAria')}
    >
      <div className="install-app-banner-icon" aria-hidden>
        C
      </div>
      <div className="install-app-banner-text">
        <div className="install-app-banner-title">{t('pwaInstall.banner.title')}</div>
        <div className="install-app-banner-subtitle">{t(subtitleKey)}</div>
      </div>
      <div className="install-app-banner-actions">
        {deferredPrompt ? (
          <button type="button" className="install-app-banner-install" onClick={() => void onInstallClick()}>
            {t('pwaInstall.banner.installButton')}
          </button>
        ) : null}
        <button type="button" className="install-app-banner-close" onClick={onDismiss} aria-label={t('pwaInstall.banner.closeAria')}>
          ×
        </button>
      </div>
    </div>
  )
}
