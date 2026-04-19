import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { count: pendingApps } = useOwnerPendingApplicationCount(user?.id, Boolean(user?.id))

  const item = (to, label, opts = {}) => {
    const active = opts.exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        {label}
      </Link>
    )
  }

  const appsActive = pathname === '/wnioski'

  return (
    <nav className="mob-nav mob-nav--six" aria-label={t('panel.quick')}>
      {item('/panel', `🏠 ${t('app.panel')}`, { exact: true })}
      {item('/flota', `🚗 ${t('nav.fleet')}`)}
      <Link to="/wnioski" className={`mob-nav-item mob-nav-item--badge-wrap${appsActive ? ' active' : ''}`}>
        📋 {t('nav.applicationsTab')}
        {pendingApps > 0 ? (
          <span className="mob-nav-item-badge" aria-label={t('panel.newApplicationsBadge')}>
            {pendingApps > 9 ? '9+' : pendingApps}
          </span>
        ) : null}
      </Link>
      {item('/statystyki', `📊 ${t('nav.statistics')}`)}
      <Link to="/dodaj" className={`mob-nav-item${pathname === '/dodaj' ? ' active' : ''}`}>
        ➕ {t('nav.addCar')}
      </Link>
      {item('/alerty', `🔔 ${t('nav.alerts')}`)}
    </nav>
  )
}
