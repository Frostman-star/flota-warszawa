import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { carPath } from '../lib/carPaths'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { buildAlertRows, formatDaysLabel } from '../utils/fleetMetrics'

export function AlertsPage() {
  const { t } = useTranslation()
  const { cars, loading, error, refresh } = useOutletContext()
  const rows = buildAlertRows(cars).sort((a, b) => a.days - b.days)

  if (loading) return <div className="page-simple"><LoadingSpinner /></div>
  if (error) return <div className="page-simple"><p className="form-error">{error}</p><button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>{t('app.refresh')}</button></div>

  return (
    <div className="page-simple">
      <p className="muted small"><Link to="/panel" className="link">← {t('app.panel')}</Link></p>
      <h1>{t('alerts.title')}</h1>
      <p className="muted lead">{t('alerts.lead')}</p>

      {rows.length === 0 ? (
        <div className="empty-ok">
          <p className="empty-ok-emoji" aria-hidden>✅</p>
          <h2>{t('alerts.emptyTitle')}</h2>
          <p className="muted">{t('alerts.emptyText')}</p>
        </div>
      ) : (
        <ul className="alert-card-list">
          {rows.map((r) => (
            <li key={`${r.carId}-${r.docLabel}-${r.date}`}>
              <Link to={carPath(r.carId, true)} className={`alert-big-card tier-border-${r.tier}`}>
                <div className="alert-big-top"><span className={`alert-dot tier-bg-${r.tier}`} aria-hidden /><span className="alert-plate">{r.plate}</span></div>
                <p className="alert-doc">{r.docLabel}</p>
                <p className="alert-days">{formatDaysLabel(r.date)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
