import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRight, ClipboardList, FileText, MessageCircleMore, Shapes, ShoppingCart, Wrench, Handshake } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { buildAlertRows, computeWeeklyRentTotal } from '../utils/fleetMetrics'
import { localeTag } from '../utils/localeTag'
import { useAuth } from '../context/AuthContext'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'
import { useOwnerPendingEmploymentRequestCount } from '../hooks/useOwnerPendingEmploymentRequestCount'
import { supabase } from '../lib/supabase'
import { sumChatAttention } from '../utils/chatAttention'

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
  const alertRows = buildAlertRows(cars)
  const toCheck = alertRows.length
  const criticalRows = alertRows.filter((row) => Number(row.days) <= 7)
  const critical = criticalRows.length
  const hasExpiredCritical = criticalRows.some((row) => Number(row.days) < 0)
  const alertTone = hasExpiredCritical ? 'danger' : 'warning'
  const trackedDocsTotal = Math.max(cars.length * 2, critical)
  const publicProfileUrl = user?.id ? `${window.location.origin}/flota/${user.id}` : ''

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
        setChatAttentionTotal(sumChatAttention(data ?? []))
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
        <div className={`urgent-banner urgent-banner--${alertTone}`} role="alert">
          <div className="urgent-banner-copy">
            <span className="urgent-banner-icon" aria-hidden>
              <AlertTriangle size={28} strokeWidth={2.4} />
            </span>
            <div className="urgent-banner-text">
              <strong>{t('panel.title')}</strong>
              <p>{t('panel.criticalBody', { count: critical })}</p>
              <span className="urgent-banner-pill">
                <FileText size={15} strokeWidth={2.2} />
                {t('panel.docsCountPill', { count: critical, total: trackedDocsTotal })}
              </span>
            </div>
          </div>
          <Link to="/alerty" className="urgent-banner-cta">
            {t('panel.seeAlerts')}
            <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
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
        <section className="card pad-lg panel-home-public-card panel-home-public-card--mini">
          <strong>{t('panel.publicProfileTitle')}</strong>
          <p className="muted small panel-public-mini-lead">{t('panel.publicProfileHint')}</p>
          <p className="panel-public-mini-link" title={publicProfileUrl}>
            {publicProfileUrl}
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => navigator.clipboard.writeText(publicProfileUrl)}
            >
              {t('panel.copyLink')}
            </button>
            <Link className="btn ghost small" to={`/flota/${user.id}`}>
              {t('panel.open')}
            </Link>
            <Link className="btn ghost small" to="/ustawienia#profil-firmy">
              {t('app.settings')}
            </Link>
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
            <Link
              key={item.id}
              to={item.href}
              className={`panel-priority-tile${item.score > 0 ? ' panel-priority-tile--alert' : ''}${item.id === 'chat' || item.id === 'applications' ? ' panel-priority-tile--button' : ' panel-priority-tile--full'}`}
            >
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
