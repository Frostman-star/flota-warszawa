import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** @typedef {{ titleMode: 'full' | 'suffix', titleKey: string, descKey: string }} MetaEntry */

/** @type {Array<{ test: (p: string) => boolean } & MetaEntry>} */
const ROUTES = [
  { test: (p) => p === '/', titleMode: 'full', titleKey: 'pageMeta.defaultDocumentTitle', descKey: 'pageMeta.defaultDesc' },
  { test: (p) => p === '/login', titleMode: 'suffix', titleKey: 'pageMeta.loginTitle', descKey: 'pageMeta.loginDesc' },
  { test: (p) => p === '/panel', titleMode: 'suffix', titleKey: 'pageMeta.panelTitle', descKey: 'pageMeta.panelDesc' },
  { test: (p) => p === '/flota', titleMode: 'suffix', titleKey: 'pageMeta.fleetTitle', descKey: 'pageMeta.fleetDesc' },
  { test: (p) => /^\/flota\/[^/]+$/.test(p), titleMode: 'suffix', titleKey: 'pageMeta.carTitle', descKey: 'pageMeta.carDesc' },
  { test: (p) => /^\/samochod\/[^/]+$/.test(p), titleMode: 'suffix', titleKey: 'pageMeta.carTitle', descKey: 'pageMeta.carDesc' },
  { test: (p) => p === '/alerty', titleMode: 'suffix', titleKey: 'pageMeta.alertsTitle', descKey: 'pageMeta.alertsDesc' },
  { test: (p) => p === '/statystyki', titleMode: 'suffix', titleKey: 'pageMeta.statsTitle', descKey: 'pageMeta.statsDesc' },
  { test: (p) => p === '/ustawienia', titleMode: 'suffix', titleKey: 'pageMeta.settingsTitle', descKey: 'pageMeta.settingsDesc' },
  { test: (p) => p === '/marketplace', titleMode: 'suffix', titleKey: 'pageMeta.marketplaceTitle', descKey: 'pageMeta.marketplaceDesc' },
  { test: (p) => p === '/serwisy', titleMode: 'suffix', titleKey: 'pageMeta.servicesTitle', descKey: 'pageMeta.servicesDesc' },
  { test: (p) => p === '/profil', titleMode: 'suffix', titleKey: 'pageMeta.driverProfileTitle', descKey: 'pageMeta.driverProfileDesc' },
  { test: (p) => p === '/moje-wnioski', titleMode: 'suffix', titleKey: 'pageMeta.driverApplicationsTitle', descKey: 'pageMeta.driverApplicationsDesc' },
  { test: (p) => p === '/wnioski', titleMode: 'suffix', titleKey: 'pageMeta.ownerApplicationsTitle', descKey: 'pageMeta.ownerApplicationsDesc' },
  { test: (p) => p === '/dodaj', titleMode: 'suffix', titleKey: 'pageMeta.wizardTitle', descKey: 'pageMeta.wizardDesc' },
  { test: (p) => p === '/brak-pojazdu', titleMode: 'suffix', titleKey: 'pageMeta.noCarTitle', descKey: 'pageMeta.noCarDesc' },
]

export function DocumentHead() {
  const { pathname } = useLocation()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const entry = ROUTES.find((r) => r.test(pathname)) ?? {
      titleMode: 'full',
      titleKey: 'pageMeta.defaultDocumentTitle',
      descKey: 'pageMeta.defaultDesc',
    }
    const suffix = t('pageMeta.brandTitleSuffix')
    document.title =
      entry.titleMode === 'full' ? t(entry.titleKey) : `${t(entry.titleKey)}${suffix}`
    const desc = t(entry.descKey)
    let el = document.querySelector('meta[name="description"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', 'description')
      document.head.appendChild(el)
    }
    el.setAttribute('content', desc)
  }, [pathname, i18n.language, t])

  return null
}
