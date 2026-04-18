import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { carPath } from '../lib/carPaths'
import { formatDaysLabel } from '../utils/fleetMetrics'

/**
 * @param {{ rows: Array<{ carId: string, plate: string, docLabel: string, date: string, days: number, tier: import('../utils/documents').AlertTier }> }} props
 */
export function AlertPanel({ rows }) {
  const { isAdmin } = useAuth()
  if (!rows.length) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Alerty dokumentów</h2>
        </header>
        <p className="muted panel-pad">Brak dokumentów wygasających w ciągu 30 dni.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Alerty dokumentów (≤ 30 dni)</h2>
        <p className="panel-sub muted">
          Kolory: czerwony — wygasło lub &lt;7 dni, pomarańczowy — 7–14 dni, żółty — 14–30 dni.
        </p>
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
                <p className="muted small">
                  Data: {r.date} · {formatDaysLabel(r.date)}
                </p>
              </div>
            </div>
            <span className={`tier-pill tier-${r.tier}`}>{r.tier}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
