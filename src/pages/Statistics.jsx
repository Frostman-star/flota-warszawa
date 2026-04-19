import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { localeTag } from '../utils/localeTag'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function monthlyIncome(car) {
  return num(car.weekly_rent_pln) * 4
}

function monthlyCosts(car) {
  return num(car.oc_cost) + num(car.ac_cost) + num(car.service_cost) + num(car.other_costs)
}

function netProfit(car) {
  return monthlyIncome(car) - monthlyCosts(car)
}

function marginPct(car) {
  const inc = monthlyIncome(car)
  if (inc <= 0) return null
  return (netProfit(car) / inc) * 100
}

function marginStatus(m) {
  if (m == null || !Number.isFinite(m)) return 'red'
  if (m < 0) return 'red'
  if (m >= 60) return 'green'
  if (m >= 30) return 'yellow'
  return 'red'
}

function marginEmoji(m) {
  const s = marginStatus(m)
  if (s === 'green') return '🟢'
  if (s === 'yellow') return '🟡'
  return '🔴'
}

function plateModel(car) {
  const plate = String(car.plate_number ?? '—')
  const model = String(car.model ?? '').trim()
  return model ? `${plate} · ${model}` : plate
}

export function Statistics() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { cars, loading, error, refresh } = useOutletContext() ?? {}

  const fmt = (n) =>
    n.toLocaleString(lc, { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, minimumFractionDigits: 0 })

  const analysis = useMemo(() => {
    const list = Array.isArray(cars) ? cars : []
    const rows = list.map((car) => {
      const income = monthlyIncome(car)
      const costs = monthlyCosts(car)
      const profit = netProfit(car)
      const margin = marginPct(car)
      const noCostData = costs <= 0
      return { car, income, costs, profit, margin, noCostData }
    })
    const sorted = [...rows].sort((a, b) => b.profit - a.profit)
    const totalIncome = rows.reduce((s, r) => s + r.income, 0)
    const totalCosts = rows.reduce((s, r) => s + r.costs, 0)
    const totalProfit = totalIncome - totalCosts

    const inProfit = rows.filter((r) => r.profit > 0).length
    const lossOrBreak = rows.filter((r) => r.profit <= 0).length

    let best = null
    let worst = null
    for (const r of rows) {
      if (!best || r.profit > best.profit) best = r
      if (!worst || r.profit < worst.profit) worst = r
    }

    const idle = rows.filter((r) => !r.car.driver_id)
    const lostIdle = idle.reduce((s, r) => s + r.income, 0)

    const maxBarMargin = rows.reduce((m, r) => {
      const v = r.margin
      if (v == null || !Number.isFinite(v)) return m
      return Math.max(m, Math.abs(v))
    }, 1)

    return {
      rows,
      sorted,
      totalIncome,
      totalCosts,
      totalProfit,
      inProfit,
      lossOrBreak,
      best,
      worst,
      idleCount: idle.length,
      lostIdle,
      maxBarMargin,
    }
  }, [cars])

  if (loading) {
    return (
      <div className="page-simple stats-page">
        <LoadingSpinner />
      </div>
    )
  }
  if (error) {
    return (
      <div className="page-simple stats-page">
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>
          {t('app.tryAgain')}
        </button>
      </div>
    )
  }

  const { sorted, totalIncome, totalCosts, totalProfit, inProfit, lossOrBreak, best, worst, idleCount, lostIdle, maxBarMargin } =
    analysis

  return (
    <div className="page-simple stats-page">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← {t('app.panel')}
        </Link>
      </p>
      <h1>{t('stats.title')}</h1>
      <p className="muted lead">{t('stats.lead')}</p>

      <section className="stats-section" aria-label={t('stats.summaryAria')}>
        <div className="stats-summary-grid">
          <article className="stats-summary-card stats-summary-card--income">
            <h2 className="stats-summary-label">{t('stats.totalMonthlyIncome')}</h2>
            <p className="stats-summary-value">{fmt(totalIncome)}</p>
          </article>
          <article className="stats-summary-card stats-summary-card--costs">
            <h2 className="stats-summary-label">{t('stats.totalMonthlyCosts')}</h2>
            <p className="stats-summary-value">{fmt(totalCosts)}</p>
          </article>
          <article
            className={`stats-summary-card stats-summary-card--profit ${totalProfit >= 0 ? 'is-positive' : 'is-negative'}`}
          >
            <h2 className="stats-summary-label">{t('stats.totalNetProfit')}</h2>
            <p className="stats-summary-value">{fmt(totalProfit)}</p>
          </article>
        </div>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">{t('stats.profitabilityTitle')}</h2>
        <div className="stats-car-list">
          {sorted.map(({ car, income, costs, profit, margin, noCostData }) => {
            const m = margin
            const marginLabel =
              m == null || !Number.isFinite(m) ? '—' : `${m.toFixed(1).replace(/\.0$/, '')}%`
            return (
              <article key={car.id} className="stats-car-card">
                <div className="stats-car-card-head">
                  <strong className="stats-car-title">
                    {car.plate_number} <span className="stats-car-model">{car.model || '—'}</span>
                  </strong>
                  <span className="stats-car-emoji" aria-hidden>
                    {marginEmoji(m)}
                  </span>
                </div>
                <dl className="stats-car-dl">
                  <div>
                    <dt>{t('stats.rowIncome')}</dt>
                    <dd className="stats-money stats-money--in">{fmt(income)}</dd>
                  </div>
                  <div>
                    <dt>{t('stats.rowCosts')}</dt>
                    <dd className="stats-money stats-money--out">{fmt(costs)}</dd>
                  </div>
                  <div>
                    <dt>{t('stats.rowNet')}</dt>
                    <dd className={`stats-money ${profit >= 0 ? 'stats-money--in' : 'stats-money--out'}`}>{fmt(profit)}</dd>
                  </div>
                  <div>
                    <dt>{t('stats.rowMargin')}</dt>
                    <dd>{marginLabel}</dd>
                  </div>
                </dl>
                {noCostData ? <p className="stats-no-cost muted small">{t('stats.noCostData')}</p> : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">{t('stats.fleetSummaryTitle')}</h2>
        <ul className="stats-fleet-list">
          <li>
            <span className="muted">{t('stats.carsInProfit')}</span> <strong>{inProfit}</strong>
          </li>
          <li>
            <span className="muted">{t('stats.carsLossBreakEven')}</span> <strong>{lossOrBreak}</strong>
          </li>
          <li>
            <span className="muted">{t('stats.bestCar')}</span>{' '}
            <strong>
              {best ? plateModel(best.car) : '—'} {best ? `(${fmt(best.profit)})` : ''}
            </strong>
          </li>
          <li>
            <span className="muted">{t('stats.worstCar')}</span>{' '}
            <strong>
              {worst ? plateModel(worst.car) : '—'} {worst ? `(${fmt(worst.profit)})` : ''}
            </strong>
          </li>
          <li>
            <span className="muted">{t('stats.idleCars')}</span> <strong>{idleCount}</strong>
            {idleCount > 0 ? (
              <>
                {' '}
                <span className="muted">·</span> {t('stats.estimatedLostIncome')}{' '}
                <strong className="stats-money--out">{fmt(lostIdle)}</strong>
              </>
            ) : null}
          </li>
        </ul>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">{t('stats.chartTitle')}</h2>
        <p className="muted small">{t('stats.chartHint')}</p>
        <div className="stats-bar-chart" role="list">
          {sorted.map(({ car, profit, margin }) => {
            const m = margin
            let widthPct = 0
            if (m != null && Number.isFinite(m)) {
              if (m >= 0) {
                widthPct = Math.min(100, Math.max(0, m))
              } else {
                widthPct = Math.min(100, (Math.abs(m) / maxBarMargin) * 40)
              }
            }
            const color = marginStatus(m)
            return (
              <div key={car.id} className="stats-bar-row" role="listitem">
                <span className="stats-bar-label">{car.plate_number}</span>
                <div className="stats-bar-track">
                  <div
                    className={`stats-bar-fill stats-bar-fill--${color}`}
                    style={{ width: `${widthPct}%` }}
                    title={m != null && Number.isFinite(m) ? `${m.toFixed(1)}%` : ''}
                  />
                </div>
                <span className={`stats-bar-value ${profit >= 0 ? 'stats-money--in' : 'stats-money--out'}`}>{fmt(profit)}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
