import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { count: pendingApps } = useOwnerPendingApplicationCount(user?.id, Boolean(user?.id))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const item = (to, label, opts = {}) => {
    const active = opts.exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        {label}
      </Link>
    )
  }

  const isMenuActive =
    pathname === '/wnioski' ||
    pathname === '/statystyki' ||
    pathname === '/serwisy' ||
    pathname === '/alerty' ||
    pathname === '/dodaj' ||
    pathname === '/ustawienia'

  return (
    <>
      <nav className="mob-nav mob-nav--four" aria-label={t('panel.quick')}>
        {item('/panel', `🏠 ${t('app.panel')}`, { exact: true })}
        {item('/flota', `🚗 ${t('nav.fleet')}`)}
        {item('/marketplace', `🛒 ${t('nav.marketplace')}`)}
        <button
          type="button"
          className={`mob-nav-item mob-nav-item--badge-wrap${isMenuActive || menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-more-menu"
        >
          ☰ {t('nav.menu')}
          {pendingApps > 0 ? (
            <span className="mob-nav-item-badge" aria-label={t('panel.newApplicationsBadge')}>
              {pendingApps > 9 ? '9+' : pendingApps}
            </span>
          ) : null}
        </button>
      </nav>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="mob-nav-menu-backdrop"
            aria-label={t('app.close')}
            onClick={() => setMenuOpen(false)}
          />
          <div id="mobile-more-menu" className="mob-nav-menu card pad-lg" role="dialog" aria-label={t('nav.menu')}>
            <div className="mob-nav-menu-head">
              <strong>{t('nav.menu')}</strong>
              <button type="button" className="btn ghost small" onClick={() => setMenuOpen(false)}>
                {t('app.close')}
              </button>
            </div>
            <div className="mob-nav-menu-links">
              <Link to="/dodaj" className={`mob-nav-menu-link${pathname === '/dodaj' ? ' active' : ''}`}>
                ➕ {t('nav.addCar')}
              </Link>
              <Link to="/wnioski" className={`mob-nav-menu-link${pathname === '/wnioski' ? ' active' : ''}`}>
                📋 {t('nav.applicationsTab')}
              </Link>
              <Link to="/statystyki" className={`mob-nav-menu-link${pathname === '/statystyki' ? ' active' : ''}`}>
                📊 {t('nav.statistics')}
              </Link>
              <Link to="/serwisy" className={`mob-nav-menu-link${pathname === '/serwisy' ? ' active' : ''}`}>
                🔧 {t('nav.services')}
              </Link>
              <Link to="/alerty" className={`mob-nav-menu-link${pathname === '/alerty' ? ' active' : ''}`}>
                🔔 {t('nav.alerts')}
              </Link>
              <Link to="/ustawienia" className={`mob-nav-menu-link${pathname === '/ustawienia' ? ' active' : ''}`}>
                ⚙️ {t('app.settings')}
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
