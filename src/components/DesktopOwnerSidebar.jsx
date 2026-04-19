import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

function navCls({ isActive }) {
  const base = 'desktop-sidebar__link'
  return isActive ? `${base} desktop-sidebar__link--active` : base
}

export function DesktopOwnerSidebar() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()

  const links = [
    { to: '/panel', end: true, label: `🏠 ${t('app.panel')}` },
    { to: '/flota', end: false, label: `🚗 ${t('nav.fleet')}` },
    { to: '/dodaj', end: true, label: `➕ ${t('panel.addCar')}` },
    { to: '/alerty', end: true, label: `🔔 ${t('nav.alerts')}` },
    { to: '/statystyki', end: true, label: `📊 ${t('nav.statistics')}` },
    { to: '/marketplace', end: true, label: `🛒 ${t('nav.marketplace')}` },
    { to: '/serwisy', end: true, label: `🔧 ${t('nav.services')}` },
    { to: '/ustawienia', end: true, label: `⚙️ ${t('app.settings')}` },
  ]

  return (
    <aside className="desktop-sidebar" aria-label={t('app.brandName')}>
      <div className="desktop-sidebar__top">
        <NavLink to="/panel" className="desktop-sidebar__brand" end>
          <span className="brand-icon" aria-hidden>
            C
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
            {l.label}
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
