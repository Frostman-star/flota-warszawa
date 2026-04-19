import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { carPath } from '../lib/carPaths'
import { formatDaysLabel } from '../utils/fleetMetrics'

/**
 * @param {{ rows: Array<{ carId: string, plate: string, docLabel: string, date: string, days: number, tier: import('../utils/documents').AlertTier }> }} props
 */
export function AlertPanel({ rows }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  if (!rows.length) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>{t('alertPanel.title')}</h2>
        </header>
        <p className="muted panel-pad">{t('alertPanel.empty')}</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{t('alertPanel.titleWindow')}</h2>
        <p className="panel-sub muted">{t('alertPanel.legend')}</p>
      </header>
      <ul className="alert-list">
        {rows.map((r) => (
          <li key={`${r.carId}-${r.docLabel}-${r.date}`} className={`alert-row tier-border-${r.tier}`}>
            <div className="alert-main">
              <span className={`alert-dot tier-bg-${r.tier}`} aria-hidden />
              <div>
                <p className="alert-title">
                  <Link to={carPath(r.carId, isAdmin)} className="link-strong">
                    {r.plate}
                  </Link>
                  <span className="muted"> · {r.docLabel}</span>
                </p>
                <p className="muted small">{t('alertPanel.dateLine', { date: r.date, relative: formatDaysLabel(r.date) })}</p>
              </div>
            </div>
            <span className={`tier-pill tier-${r.tier}`}>{r.tier}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
