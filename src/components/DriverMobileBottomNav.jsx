import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function DriverMobileBottomNav() {
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
    <nav className="mob-nav mob-nav--driver" aria-label={t('panel.quick')}>
      {item('/marketplace', `🛒 ${t('nav.marketplace')}`, { exact: true })}
      {item('/obrane', `❤️ ${t('favorites.title')}`, { exact: true })}
      {item('/zarobki', `💸 ${t('nav.finance')}`, { exact: true })}
      {item('/profil', `👤 ${t('nav.profile')}`, { exact: true })}
      {item('/moje-wnioski', `📋 ${t('nav.myApplications')}`)}
    </nav>
  )
}
