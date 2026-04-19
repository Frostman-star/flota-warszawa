import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { localeTag } from '../utils/localeTag'
import { daysUntil, parseLocalDate } from '../utils/documents'

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

/** Weekly rent sum for cars that currently have a driver (proxy per week — no historical snapshots). */
function activeWeeklyRentTotal(carsList) {
  return carsList.filter((c) => Boolean(c.driver_id)).reduce((s, c) => s + num(c.weekly_rent_pln), 0)
}

/**
 * @param {Array<Record<string, unknown>>} carsList
 * @param {import('i18next').TFunction} t
 */
function collectUpcomingDocCosts(carsList, t) {
  /** @type {Array<{ plate: string, docKey: string, docLabel: string, date: string, cost: number, missing: boolean }>} */
  const out = []
  const defs = [
    { expiryKey: 'oc_expiry', costKey: 'oc_cost', docKey: 'oc' },
    { expiryKey: 'ac_expiry', costKey: 'ac_cost', docKey: 'ac' },
    { expiryKey: 'przeglad_expiry', costKey: 'service_cost', docKey: 'prz' },
  ]
  for (const car of carsList) {
    const plate = String(car.plate_number ?? '—')
    for (const def of defs) {
      const date = car[def.expiryKey]
      if (typeof date !== 'string' || !date) continue
      const d = daysUntil(date)
      if (d === null || d < 0 || d > 30) continue
      const cost = num(car[def.costKey])
      out.push({
        plate,
        docKey: def.docKey,
        docLabel: t(`stats.docType.${def.docKey}`),
        date,
        cost,
        missing: cost <= 0,
      })
    }
  }
  out.sort((a, b) => {
    const da = parseLocalDate(a.date)
    const db = parseLocalDate(b.date)
    if (!da || !db) return 0
    return da.getTime() - db.getTime()
  })
  const sum = out.filter((r) => !r.missing).reduce((s, r) => s + r.cost, 0)
  return { rows: out, sum }
}

export function Statistics() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { cars, loading, error, refresh } = useOutletContext() ?? {}

  const fmt = (n) =>
    n.toLocaleString(lc, { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, minimumFractionDigits: 0 })

  const analysis = useMemo(() => {
    const fmtMoney = (n) =>
      n.toLocaleString(lc, { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, minimumFractionDigits: 0 })

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

    const weeklyActiveIncome = activeWeeklyRentTotal(list)
    const weekTrend = Array.from({ length: 8 }, () => weeklyActiveIncome)
    const trendAvg =
      weekTrend.length > 0 ? weekTrend.reduce((a, b) => a + b, 0) / weekTrend.length : 0
    const trendMax = Math.max(...weekTrend, trendAvg, 1)

    const avgFleetWeeklyRent = list.length > 0 ? list.reduce((s, c) => s + num(c.weekly_rent_pln), 0) / list.length : 0
    const idleMonthlyOpportunity = idle.length * avgFleetWeeklyRent * 4

    const upcoming = collectUpcomingDocCosts(list, t)

    const hasNoCostInsight = rows.some((r) => r.noCostData && r.income > 0)
    const lowMarginRows = rows.filter((r) => r.margin != null && Number.isFinite(r.margin) && r.income > 0 && r.margin < 30)
    const worstLowMargin =
      lowMarginRows.length > 0 ? [...lowMarginRows].sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0))[0] : null

    const insightCandidates = []
    if (hasNoCostInsight) {
      const first = rows.find((r) => r.noCostData && r.income > 0)
      if (first) {
        insightCandidates.push({
          key: 'noCost',
          text: t('stats.insightNoCost', { plate: String(first.car.plate_number ?? '—') }),
        })
      }
    }
    if (idle.length > 0) {
      insightCandidates.push({
        key: 'idle',
        text: t('stats.insightIdle', { n: idle.length, amount: fmtMoney(idleMonthlyOpportunity) }),
      })
    }
    if (worstLowMargin) {
      insightCandidates.push({
        key: 'lowMargin',
        text: t('stats.insightLowMargin', {
          plate: String(worstLowMargin.car.plate_number ?? '—'),
          pct: String(Math.round(worstLowMargin.margin ?? 0)),
        }),
      })
    }
    if (insightCandidates.length === 0 && rows.length > 0 && rows.every((r) => r.profit > 0)) {
      insightCandidates.push({ key: 'celebrate', text: t('stats.insightAllProfitable') })
    }
    const insights = insightCandidates.slice(0, 3)

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
      weekTrend,
      trendAvg,
      trendMax,
      weeklyActiveIncome,
      idleMonthlyOpportunity,
      upcomingRows: upcoming.rows,
      upcomingSum: upcoming.sum,
      insights,
    }
  }, [cars, t, lc])

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

  const {
    sorted,
    totalIncome,
    totalCosts,
    totalProfit,
    inProfit,
    lossOrBreak,
    best,
    worst,
    idleCount,
    lostIdle,
    maxBarMargin,
    weekTrend,
    trendAvg,
    trendMax,
    idleMonthlyOpportunity,
    upcomingRows,
    upcomingSum,
    insights,
    weeklyActiveIncome,
  } = analysis

  const trendScaleMax = trendMax > 0 ? trendMax : 1
  const avgLineBottomPct = (trendAvg / trendScaleMax) * 100

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

      <section className="stats-section" aria-label={t('stats.trendAria')}>
        <h2 className="stats-section-title">{t('stats.trendTitle')}</h2>
        <p className="muted small">{t('stats.trendNote')}</p>
        <div className="stats-trend-yaxis muted small">{t('stats.trendYLabel')}</div>
        <div className="stats-trend-plot">
          <div className="stats-trend-chart-row">
            <div className="stats-trend-avgline" style={{ bottom: `${avgLineBottomPct}%` }} aria-hidden />
            <div className="stats-trend-cols">
              {weekTrend.map((val, i) => {
                const h = (val / trendScaleMax) * 100
                return (
                  <div key={i} className="stats-trend-col">
                    <div className="stats-trend-track">
                      <div className="stats-trend-bar" style={{ height: `${h}%` }} title={fmt(val)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="stats-trend-x-row">
            {weekTrend.map((_, i) => (
              <span key={i} className="stats-trend-x muted small">
                {t('stats.weekShort', { n: i + 1 })}
              </span>
            ))}
          </div>
        </div>
        <div className="stats-trend-footer muted small">
          <span>{t('stats.trendAvgLine', { value: fmt(trendAvg) })}</span>
          <span>{t('stats.trendCurrentWeekly', { value: fmt(weeklyActiveIncome) })}</span>
        </div>
      </section>

      <section className="stats-section">
        <article className="stats-idle-cost-card">
          <p className="stats-idle-cost-text">
            {t('stats.idleCostCard', { amount: fmt(idleMonthlyOpportunity) })}
          </p>
          <Link to="/marketplace?manage=1" className="btn btn-huge primary stats-idle-cost-btn">
            {t('stats.addToMarketplace')}
          </Link>
        </article>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">{t('stats.forecastTitle')}</h2>
        {upcomingRows.length === 0 ? (
          <p className="muted">{t('stats.forecastEmpty')}</p>
        ) : (
          <>
            <ul className="stats-forecast-list">
              {upcomingRows.map((row, idx) => (
                <li key={`${row.plate}-${row.docKey}-${row.date}-${idx}`} className="stats-forecast-row">
                  <span className="stats-forecast-plate">{row.plate}</span>
                  <span className="muted">{row.docLabel}</span>
                  <span>{row.date}</span>
                  <span className={row.missing ? 'muted' : 'stats-money--out'}>
                    {row.missing ? t('stats.enterCostHint') : fmt(row.cost)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="stats-forecast-sum">
              <strong>{t('stats.forecastSum')}</strong> {fmt(upcomingSum)}
            </p>
          </>
        )}
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">{t('stats.insightsTitle')}</h2>
        {insights.length === 0 ? (
          <p className="muted">{t('stats.insightsEmpty')}</p>
        ) : (
          <div className="stats-insights-grid">
            {insights.map((item) => (
              <article key={item.key} className="stats-insight-card">
                <p className="stats-insight-text">{item.text}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
