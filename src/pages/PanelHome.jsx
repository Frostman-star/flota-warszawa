import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { buildAlertRows, computeWeeklyRentTotal } from '../utils/fleetMetrics'
import { daysUntil } from '../utils/documents'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { localeTag } from '../utils/localeTag'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'

function countCriticalSoon(cars) {
  let n = 0
  for (const car of cars) {
    const ins = effectiveInsuranceExpiryIso(car)
    for (const date of [ins, car.przeglad_expiry]) {
      const d = daysUntil(typeof date === 'string' ? date : null)
      if (d !== null && d <= 7) n += 1
    }
  }
  return n
}

export function PanelHome() {
  const { t, i18n } = useTranslation()
  const { cars, loading, error, refresh } = useOutletContext()
  const { user } = useAuth()
  const location = useLocation()
  const { count: pendingApps } = useOwnerPendingApplicationCount(user?.id, Boolean(user?.id))
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const weekly = computeWeeklyRentTotal(cars)
  const toCheck = buildAlertRows(cars).length
  const critical = countCriticalSoon(cars)

  if (loading) return <div className="page-simple"><LoadingSpinner /></div>
  if (error) {
    return (
      <div className="page-simple">
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>{t('app.tryAgain')}</button>
      </div>
    )
  }

  return (
    <div className="page-simple">
      {critical > 0 ? (
        <div className="urgent-banner" role="alert">
          <strong>{t('panel.title')}</strong>
          <p>{t('panel.criticalBody', { count: critical })}</p>
          <Link to="/alerty" className="btn btn-huge light">{t('panel.seeAlerts')}</Link>
        </div>
      ) : null}

      <section className="hero-summary" aria-label={t('panel.summary')}>
        <div className="hero-stat"><span className="hero-stat-num">{cars.length}</span><span className="hero-stat-label">{t('panel.cars')}</span></div>
        <div className="hero-stat"><span className="hero-stat-num">{weekly.toLocaleString(lc, { maximumFractionDigits: 0 })} zł</span><span className="hero-stat-label">{t('panel.weekly')}</span></div>
        <div className="hero-stat"><span className="hero-stat-num">{toCheck}</span><span className="hero-stat-label">{t('panel.toCheck')}</span></div>
      </section>
      {location.state?.toast ? <p className="form-info">{String(location.state.toast)}</p> : null}

      {user?.id ? (
        <section className="card pad-lg">
          <strong>{t('panel.publicProfileTitle')}</strong>
          <p className="muted small mb-0">{`${window.location.origin}/flota/${user.id}`}</p>
          <p className="muted small">{t('panel.publicProfileHint')}</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/flota/${user.id}`)}
            >
              {t('panel.copyLink')}
            </button>
            <a className="btn ghost small" href={`/flota/${user.id}`} target="_blank" rel="noreferrer">
              {t('panel.open')}
            </a>
          </div>
        </section>
      ) : null}

      <Link
        to="/wnioski"
        className={`panel-pending-apps card pad-lg${pendingApps > 0 ? ' panel-pending-apps--alert' : ''}`}
      >
        <span className="panel-pending-apps-emoji" aria-hidden>
          📋
        </span>
        <div className="panel-pending-apps-body">
          <strong>{t('panel.newApplicationsCard', { count: pendingApps })}</strong>
          <p className="muted small mb-0">{t('panel.newApplicationsHint')}</p>
        </div>
        {pendingApps > 0 ? (
          <span className="panel-pending-apps-badge" aria-label={t('panel.newApplicationsBadge')}>
            {pendingApps > 99 ? '99+' : pendingApps}
          </span>
        ) : null}
      </Link>

      <nav className="big-actions" aria-label={t('panel.quick')}>
        <Link to="/dodaj" className="big-action big-action-primary"><span className="big-action-emoji" aria-hidden>➕</span><span className="big-action-text">{t('panel.addCar')}</span></Link>
        <Link to="/flota" className="big-action"><span className="big-action-emoji" aria-hidden>🚗</span><span className="big-action-text">{t('panel.myCars')}</span></Link>
        <Link to="/alerty" className="big-action"><span className="big-action-emoji" aria-hidden>🔔</span><span className="big-action-text">{t('nav.alerts')}</span></Link>
        <Link to="/statystyki" className="big-action"><span className="big-action-emoji" aria-hidden>📊</span><span className="big-action-text">{t('nav.statistics')}</span></Link>
      </nav>

      <p className="muted small footer-hint">
        <Link to="/ustawienia" className="link">{t('app.settings')}</Link>
        {' · '}
        <Link to="/marketplace" className="link">{t('panel.market')}</Link>
      </p>
    </div>
  )
}
