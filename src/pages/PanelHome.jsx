import { Link, useOutletContext } from 'react-router-dom'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { buildAlertRows, computeWeeklyRentTotal } from '../utils/fleetMetrics'
import { daysUntil } from '../utils/documents'

function countCriticalSoon(cars) {
  let n = 0
  for (const car of cars) {
    for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
      const d = daysUntil(car[key])
      if (d !== null && d <= 7) n += 1
    }
  }
  return n
}

export function PanelHome() {
  const { cars, loading, error, refresh } = useOutletContext()
  const weekly = computeWeeklyRentTotal(cars)
  const toCheck = buildAlertRows(cars).length
  const critical = countCriticalSoon(cars)
  const showBanner = critical > 0

  if (loading) {
    return (
      <div className="page-simple">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-simple">
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  return (
    <div className="page-simple">
      {showBanner ? (
        <div className="urgent-banner" role="alert">
          <strong>Uwaga na dziś</strong>
          <p>Masz {critical} dokumentów wymagających pilnej uwagi (≤ 7 dni lub po terminie).</p>
          <Link to="/alerty" className="btn btn-huge light">
            Zobacz alerty
          </Link>
        </div>
      ) : null}

      <section className="hero-summary" aria-label="Podsumowanie">
        <div className="hero-stat">
          <span className="hero-stat-num">{cars.length}</span>
          <span className="hero-stat-label">aut w flocie</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-num">
            {weekly.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
          </span>
          <span className="hero-stat-label">łącznie / tydzień</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-num">{toCheck}</span>
          <span className="hero-stat-label">do sprawdzenia (30 dni)</span>
        </div>
      </section>

      <nav className="big-actions" aria-label="Szybkie akcje">
        <Link to="/dodaj" className="big-action big-action-primary">
          <span className="big-action-emoji" aria-hidden>
            ➕
          </span>
          <span className="big-action-text">Dodaj auto</span>
        </Link>
        <Link to="/flota" className="big-action">
          <span className="big-action-emoji" aria-hidden>
            🚗
          </span>
          <span className="big-action-text">Moje auta</span>
        </Link>
        <Link to="/alerty" className="big-action">
          <span className="big-action-emoji" aria-hidden>
            🔔
          </span>
          <span className="big-action-text">Alerty</span>
        </Link>
      </nav>

      <p className="muted small footer-hint">
        <Link to="/ustawienia" className="link">
          Ustawienia
        </Link>
        {' · '}
        <Link to="/marketplace" className="link">
          Marketplace (beta)
        </Link>
      </p>
    </div>
  )
}
