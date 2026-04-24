import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, Car, Handshake, LayoutGrid, Plus, Settings, ShoppingCart, Wrench, BarChart3, Bot, Lock, MessageCircleMore } from 'lucide-react'

function navCls({ isActive }) {
  const base = 'desktop-sidebar__link'
  return isActive ? `${base} desktop-sidebar__link--active` : base
}

export function DesktopOwnerSidebar() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const aiLocked = !(profile?.role === 'admin' || (profile?.role === 'owner' && profile?.plan_tier === 'pro'))

  const links = [
    { to: '/panel', end: true, label: t('app.panel'), Icon: LayoutGrid },
    { to: '/flota', end: false, label: t('nav.fleet'), Icon: Car },
    { to: '/zapytania-kierowcow', end: true, label: t('nav.employmentRequests'), Icon: Handshake },
    { to: '/dodaj', end: true, label: t('panel.addCar'), Icon: Plus },
    { to: '/alerty', end: true, label: t('nav.alerts'), Icon: AlertTriangle },
    { to: '/statystyki', end: true, label: t('nav.statistics'), Icon: BarChart3 },
    { to: '/chats', end: false, label: t('nav.chats'), Icon: MessageCircleMore },
    { to: '/ai-manager', end: true, label: t('nav.aiManager'), Icon: Bot, pro: true, locked: aiLocked },
    { to: '/marketplace', end: true, label: t('nav.marketplace'), Icon: ShoppingCart },
    { to: '/serwisy', end: true, label: t('nav.services'), Icon: Wrench },
    { to: '/ustawienia', end: true, label: t('app.settings'), Icon: Settings },
  ]

  return (
    <aside className="desktop-sidebar" aria-label={t('app.brandName')}>
      <div className="desktop-sidebar__top">
        <NavLink to="/panel" className="desktop-sidebar__brand" end>
          <span className="brand-icon" aria-hidden>
            <img src="/brand-emblem.png" alt="" className="brand-icon-img" />
          </span>
          <span className="desktop-sidebar__brand-text">
            <span className="desktop-sidebar__brand-name">{t('app.brandName')}</span>
            <span className="desktop-sidebar__brand-tag muted small">{t('app.brandTagline')}</span>
          </span>
        </NavLink>
      </div>
      <nav className="desktop-sidebar__nav" aria-label={t('panel.quick')}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>
            <span className="desktop-sidebar__link-icon" aria-hidden>
              <l.Icon size={15} strokeWidth={2.1} />
            </span>
            <span>{l.label}</span>
            {l.pro ? <span className="desktop-sidebar__pro-badge">PRO</span> : null}
            {l.locked ? (
              <span className="desktop-sidebar__pro-lock" aria-label={t('aiManager.locked')}>
                <Lock size={13} />
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="desktop-sidebar__footer">
        <div className="desktop-sidebar__user muted small" title={profile?.email ?? ''}>
          {profile?.full_name ?? profile?.email ?? t('app.user')}
        </div>
        <button type="button" className="btn ghost small desktop-sidebar__logout" onClick={() => signOut()}>
          {t('app.logout')}
        </button>
      </div>
    </aside>
  )
}
