export const CARIO_INSTALL_DISMISSED_KEY = 'cario_install_dismissed'

export function getIsPwaInstalled() {
  if (typeof window === 'undefined') return true
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (typeof window.navigator.standalone === 'boolean' && window.navigator.standalone) return true
  } catch {
    /* ignore */
  }
  return false
}

export function isIosUserAgent() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isAndroidUserAgent() {
  if (typeof navigator === 'undefined') return false
  return /Android/.test(navigator.userAgent)
}

export function isMobileViewportWidth() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

export function isInstallBannerDismissedInStorage() {
  try {
    return localStorage.getItem(CARIO_INSTALL_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}
