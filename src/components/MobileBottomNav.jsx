import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  const item = (to, label, opts = {}) => {
    const active = opts.exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        {label}
      </Link>
    )
  }

  return (
    <nav className="mob-nav" aria-label={t('panel.quick')}>
      {item('/panel', `🏠 ${t('app.panel')}`, { exact: true })}
      {item('/flota', `🚗 ${t('nav.fleet')}`)}
      <Link to="/dodaj" className={`mob-nav-item${pathname === '/dodaj' ? ' active' : ''}`}>
        ➕ {t('nav.addCar')}
      </Link>
      {item('/alerty', `🔔 ${t('nav.alerts')}`)}
    </nav>
  )
}
