import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ClipboardList, MessageCircleMore, Plus, Shapes, ShoppingCart, Wrench, Handshake } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { buildAlertRows, computeWeeklyRentTotal } from '../utils/fleetMetrics'
import { daysUntil } from '../utils/documents'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { localeTag } from '../utils/localeTag'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'
import { useOwnerPendingEmploymentRequestCount } from '../hooks/useOwnerPendingEmploymentRequestCount'
import { supabase } from '../lib/supabase'

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
  const { count: pendingEmployment } = useOwnerPendingEmploymentRequestCount(user?.id, Boolean(user?.id))
  const [chatAttentionTotal, setChatAttentionTotal] = useState(0)
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const weekly = computeWeeklyRentTotal(cars)
  const toCheck = buildAlertRows(cars).length
  const critical = countCriticalSoon(cars)

  useEffect(() => {
    const ids = (cars ?? []).map((c) => c.id).filter(Boolean)
    if (!user?.id || !ids.length) {
      setChatAttentionTotal(0)
      return
    }
    let cancelled = false
    void supabase
      .rpc('owner_fleet_car_attention_counts', { p_car_ids: ids })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return
        if (rpcErr) {
          console.error(rpcErr)
          setChatAttentionTotal(0)
          return
        }
        const total = (data ?? []).reduce((acc, row) => acc + Number(row.chat_attention ?? 0), 0)
        setChatAttentionTotal(total)
      })
    return () => {
      cancelled = true
    }
  }, [cars, user?.id])

  const priorityItems = useMemo(() => {
    const items = []
    if (critical <= 0) {
      items.push({
        id: 'alerts',
        href: '/alerty',
        Icon: AlertTriangle,
        title: t('nav.alerts'),
        subtitle: t('panel.criticalBody', { count: critical }),
        score: Number(critical || 0),
      })
    }
    items.push(
      {
        id: 'applications',
        href: '/wnioski',
        Icon: ClipboardList,
        title: t('nav.applicationsTab'),
        subtitle: t('panel.newApplicationsCard', { count: pendingApps }),
        score: Number(pendingApps || 0),
      },
      {
        id: 'chat',
        href: '/wnioski?focus=chat',
        Icon: MessageCircleMore,
        title: t('ownerApplications.openChat'),
        subtitle: t('panel.chatNeedsReplyCard', { count: chatAttentionTotal }),
        score: Number(chatAttentionTotal || 0),
      }
    )
    return items.sort((a, b) => b.score - a.score)
  }, [critical, pendingApps, chatAttentionTotal, t])

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
    <div className="page-simple panel-home-shell">
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

      <section className="panel-hero-cta card pad-lg" aria-label={t('panel.addCar')}>
        <div className="panel-hero-cta-glow" aria-hidden />
        <div className="panel-hero-cta-icon" aria-hidden><Plus size={28} strokeWidth={2.2} /></div>
        <h2 className="panel-hero-cta-title">{t('panel.addCar')}</h2>
        <div className="panel-hero-cta-actions">
          <Link to="/dodaj" className="btn panel-hero-cta-btn">
            {t('panel.addCar')}
          </Link>
          <Link to="/flota" className="panel-hero-cta-link">
            {t('panel.myCars')} →
          </Link>
        </div>
      </section>

      {user?.id ? (
        <section className="card pad-lg panel-home-public-card">
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

      <section className="panel-priority-inbox card pad-lg" aria-label={t('panel.priorityInboxTitle')}>
        <header className="panel-priority-inbox-head">
          <strong>{t('panel.priorityInboxTitle')}</strong>
          <span className="muted small">{t('panel.priorityInboxLead')}</span>
        </header>
        <div className="panel-priority-inbox-grid">
          {priorityItems.map((item) => (
            <Link key={item.id} to={item.href} className={`panel-priority-tile${item.score > 0 ? ' panel-priority-tile--alert' : ''}`}>
              <span className="panel-priority-tile-emoji" aria-hidden>
                <item.Icon size={17} strokeWidth={2.1} />
              </span>
              <span className="panel-priority-tile-body">
                <strong>{item.title}</strong>
                <span className="muted small">{item.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <nav className="big-actions" aria-label={t('panel.quick')}>
        <Link to="/zapytania-kierowcow" className="big-action"><span className="big-action-emoji" aria-hidden><Handshake size={19} strokeWidth={2.2} /></span><span className="big-action-text">{t('nav.employmentRequests')}</span></Link>
        <Link to="/serwisy" className="big-action"><span className="big-action-emoji" aria-hidden><Wrench size={19} strokeWidth={2.2} /></span><span className="big-action-text">{t('nav.services')}</span></Link>
        <Link to="/statystyki" className="big-action"><span className="big-action-emoji" aria-hidden><Shapes size={19} strokeWidth={2.2} /></span><span className="big-action-text">{t('nav.statistics')}</span></Link>
        <Link to="/marketplace" className="big-action"><span className="big-action-emoji" aria-hidden><ShoppingCart size={19} strokeWidth={2.2} /></span><span className="big-action-text">{t('nav.marketplace')}</span></Link>
      </nav>

      <p className="muted small footer-hint">
        <Link to="/ustawienia" className="link">{t('app.settings')}</Link>
        {' · '}
        <Link to="/marketplace" className="link">{t('panel.market')}</Link>
      </p>
    </div>
  )
}
