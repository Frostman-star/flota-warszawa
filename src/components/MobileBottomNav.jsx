import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, Bot, Car, ClipboardList, LayoutGrid, Lock, Menu, MessageCircleMore, Plus, Settings, Sparkles, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const { count: pendingApps } = useOwnerPendingApplicationCount(user?.id, Boolean(user?.id))
  const [menuOpen, setMenuOpen] = useState(false)
  const aiLocked = !(profile?.role === 'admin' || (profile?.role === 'owner' && profile?.plan_tier === 'pro'))

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const item = (to, Icon, label, opts = {}) => {
    const active = opts.exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        <span className="mob-nav-item-icon" aria-hidden><Icon size={18} strokeWidth={2.1} /></span>
        <span>{label}</span>
      </Link>
    )
  }

  const isMenuActive =
    pathname === '/wnioski' ||
    pathname === '/statystyki' ||
    pathname === '/serwisy' ||
    pathname === '/chats' ||
    pathname === '/alerty' ||
    pathname === '/dodaj' ||
    pathname === '/ustawienia'

  return (
    <>
      <nav className="mob-nav mob-nav--four" aria-label={t('panel.quick')}>
        {item('/panel', LayoutGrid, t('app.panel'), { exact: true })}
        {item('/flota', Car, t('nav.fleet'))}
        {item('/marketplace', Sparkles, t('nav.marketplace'))}
        <button
          type="button"
          className={`mob-nav-item mob-nav-item--badge-wrap${isMenuActive || menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-more-menu"
        >
          <span className="mob-nav-item-icon" aria-hidden><Menu size={18} strokeWidth={2.1} /></span>
          <span>{t('nav.menu')}</span>
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
                <span className="mob-nav-item-icon" aria-hidden><Plus size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.addCar')}</span>
              </Link>
              <Link to="/wnioski" className={`mob-nav-menu-link${pathname === '/wnioski' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><ClipboardList size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.applicationsTab')}</span>
              </Link>
              <Link to="/statystyki" className={`mob-nav-menu-link${pathname === '/statystyki' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><LayoutGrid size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.statistics')}</span>
              </Link>
              <Link to="/ai-manager" className={`mob-nav-menu-link${pathname === '/ai-manager' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><Bot size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.aiManager')}</span>
                <span className="mob-nav-menu-pro-badge">PRO</span>
                {aiLocked ? (
                  <span className="mob-nav-menu-lock" aria-label={t('aiManager.locked')}>
                    <Lock size={13} />
                  </span>
                ) : null}
              </Link>
              <Link to="/serwisy" className={`mob-nav-menu-link${pathname === '/serwisy' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><Wrench size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.services')}</span>
              </Link>
              <Link to="/chats" className={`mob-nav-menu-link${pathname.startsWith('/chats') ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><MessageCircleMore size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.chats')}</span>
              </Link>
              <Link to="/alerty" className={`mob-nav-menu-link${pathname === '/alerty' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><Bell size={18} strokeWidth={2.1} /></span>
                <span>{t('nav.alerts')}</span>
              </Link>
              <Link to="/ustawienia" className={`mob-nav-menu-link${pathname === '/ustawienia' ? ' active' : ''}`}>
                <span className="mob-nav-item-icon" aria-hidden><Settings size={18} strokeWidth={2.1} /></span>
                <span>{t('app.settings')}</span>
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
