import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, MessageCircleMore } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DriverProfileCard } from '../components/DriverProfileCard'

export function OwnerApplications() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const carFilter = searchParams.get('carId')
  const focusChat = searchParams.get('focus') === 'chat'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [banner, setBanner] = useState(/** @type {{ type: 'success' | 'error'; text: string } | null} */ (null))
  /** @type {[string | null, import('react').Dispatch<import('react').SetStateAction<string | null>>]} */
  const [actionBusyId, setActionBusyId] = useState(null)
  const [selectedAppId, setSelectedAppId] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from('driver_applications')
      .select(
        `
        id,
        status,
        lead_source,
        created_at,
        driver_message,
        driver_name,
        driver_phone,
        driver_id,
        car_id,
        car:cars ( plate_number, model, year ),
        driver:profiles!driver_id (
          full_name,
          phone,
          experience_years,
          bio,
          gender,
          birth_year,
          poland_status,
          poland_status_doc_url,
          avatar_url
        )
      `
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) {
      setErr(error.message)
      setRows([])
      return
    }
    setRows(data ?? [])
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!carFilter) return rows
    return rows.filter((r) => String(r.car_id ?? '') === carFilter)
  }, [rows, carFilter])

  const filterPlate = useMemo(() => {
    const first = filteredRows[0]?.car?.plate_number
    return first != null && String(first).trim() !== '' ? String(first) : '—'
  }, [filteredRows])

  /** @type {[Set<string>, import('react').Dispatch<import('react').SetStateAction<Set<string>>>]} */
  const [chatReplyIds, setChatReplyIds] = useState(() => new Set())

  useEffect(() => {
    if (!carFilter || !user?.id) {
      setChatReplyIds(new Set())
      return
    }
    let cancelled = false
    void supabase.rpc('owner_application_ids_needing_owner_reply_for_car', { p_car_id: carFilter }).then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.error(error)
        setChatReplyIds(new Set())
        return
      }
      const ids = new Set((data ?? []).map((x) => String(x.application_id)))
      setChatReplyIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [carFilter, user?.id, rows])

  const rejectApplication = useCallback(
    async (applicationId) => {
      if (!window.confirm(t('ownerApplications.confirmReject'))) return
      setActionBusyId(applicationId)
      setBanner(null)
      try {
        const { error } = await supabase.rpc('reject_driver_application', { p_application_id: applicationId })
        if (error) throw error
        setBanner({ type: 'success', text: t('ownerApplications.rejectedFlash') })
        await load()
      } catch (e) {
        console.error(e)
        setBanner({ type: 'error', text: e?.message ?? String(e) })
      } finally {
        setActionBusyId(null)
      }
    },
    [load, t]
  )

  const grouped = useMemo(() => {
    const m = new Map()
    for (const r of filteredRows) {
      const cid = String(r.car_id ?? '')
      if (!m.has(cid)) m.set(cid, { car: r.car, apps: [] })
      m.get(cid).apps.push(r)
    }
    return [...m.values()].map((g) => {
      if (!focusChat) return g
      const appsSorted = [...g.apps].sort((a, b) => {
        const ap = String(a.status || '') === 'pending' && chatReplyIds.has(String(a.id)) ? 0 : 1
        const bp = String(b.status || '') === 'pending' && chatReplyIds.has(String(b.id)) ? 0 : 1
        return ap - bp
      })
      return { ...g, apps: appsSorted }
    })
  }, [filteredRows, focusChat, chatReplyIds])

  const pendingCount = useMemo(() => filteredRows.filter((r) => String(r.status || '') === 'pending').length, [filteredRows])
  const replyNeededCount = useMemo(
    () =>
      filteredRows.filter(
        (r) => String(r.status || '') === 'pending' && (!carFilter || chatReplyIds.has(String(r.id)))
      ).length,
    [filteredRows, carFilter, chatReplyIds]
  )
  const openChatPlain = t('ownerApplications.openChatPlain')

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedAppId(null)
      return
    }
    setSelectedAppId((prev) => (prev && filteredRows.some((r) => String(r.id) === prev) ? prev : String(filteredRows[0].id)))
  }, [filteredRows])

  const selectedApp = useMemo(
    () => filteredRows.find((r) => String(r.id) === String(selectedAppId)) ?? null,
    [filteredRows, selectedAppId]
  )

  function renderAppCard(app, { compact = false } = {}) {
    const d = app.driver
    const phone = String(app.driver_phone || d?.phone || '').trim()
    const profileForCard = {
      full_name: app.driver_name || d?.full_name,
      phone,
      experience_years: d?.experience_years,
      bio: d?.bio,
      gender: d?.gender,
      birth_year: d?.birth_year,
      poland_status: d?.poland_status,
      poland_status_doc_url: d?.poland_status_doc_url,
      avatar_url: d?.avatar_url,
    }
    const lead = String(app.lead_source || 'unknown')
    const leadClass = lead === 'cario_marketplace' ? 'owner-app-lead owner-app-lead--marketplace' : 'owner-app-lead owner-app-lead--other'
    const st = String(app.status || 'pending')
    const statusLabel =
      st === 'accepted' ? t('driverApplications.statusAccepted') : st === 'rejected' ? t('driverApplications.statusRejected') : t('driverApplications.statusPending')
    const needsChat = Boolean(carFilter) && st === 'pending' && chatReplyIds.has(String(app.id))
    return (
      <>
        {needsChat ? <span className="owner-app-chat-ping">{t('ownerApplications.chatAwaitingReply')}</span> : null}
        <span className={leadClass}>{t(`ownerApplications.leadSource.${lead}`)}</span>
        <DriverProfileCard profile={profileForCard} showDocVerified className="owner-app-driver-card" />
        <div className="owner-app-card-top owner-app-card-phone-row">
          {phone ? (
            <a className="owner-app-phone" href={`tel:${phone.replace(/\s+/g, '')}`}>
              {phone}
            </a>
          ) : (
            <span className="muted small">—</span>
          )}
        </div>
        {!compact && app.driver_message ? <p className="owner-app-msg">{String(app.driver_message)}</p> : null}
        <p className="muted tiny">{app.created_at ? new Date(app.created_at).toLocaleString() : ''}</p>
        {st === 'pending' ? <p className="muted tiny owner-apps-assign-hint">{t('ownerApplications.assignInChatHint')}</p> : null}
        <div className="owner-app-actions">
          {st === 'pending' ? (
            <button
              type="button"
              className="btn small ghost owner-app-reject"
              disabled={Boolean(actionBusyId)}
              onClick={() => void rejectApplication(app.id)}
            >
              {actionBusyId === app.id ? t('ownerApplications.rejectBusy') : t('ownerApplications.reject')}
            </button>
          ) : null}
          <Link className="btn ghost small" to={`/rozmowa-wniosek/${app.id}`}>
            {t('ownerApplications.openChat')}
          </Link>
        </div>
        <span className={`status-pill status-pill--${st}`}>{statusLabel}</span>
      </>
    )
  }

  return (
    <div className="page-simple owner-apps-page">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← {t('app.panel')}
        </Link>
      </p>
      <h1>{t('ownerApplications.title')}</h1>
      <p className="muted">{t('ownerApplications.lead')}</p>

      {carFilter ? (
        <p className="owner-apps-filter-banner muted small" role="status">
          {focusChat
            ? t('ownerApplications.filterCarChat', { plate: filterPlate })
            : t('ownerApplications.filterCar', { plate: filterPlate })}{' '}
          <Link to="/wnioski" className="link-strong">
            {t('ownerApplications.clearCarFilter')}
          </Link>
        </p>
      ) : null}

      {focusChat && carFilter ? <p className="muted small owner-apps-chat-focus-hint">{t('ownerApplications.chatFocusHint')}</p> : null}

      <section className="card pad-lg owner-apps-inbox-strip" aria-label={t('ownerApplications.title')}>
        <div className="owner-apps-inbox-stat owner-apps-inbox-stat--icon">
          <span className="owner-apps-inbox-stat-icon" aria-hidden>
            <ClipboardList size={17} strokeWidth={2.1} />
          </span>
          <strong>{pendingCount}</strong>
          <span className="muted small">{t('driverApplications.statusPending')}</span>
        </div>
        <div className="owner-apps-inbox-stat owner-apps-inbox-stat--icon">
          <span className="owner-apps-inbox-stat-icon" aria-hidden>
            <MessageCircleMore size={17} strokeWidth={2.1} />
          </span>
          <strong>{replyNeededCount}</strong>
          <span className="muted small">{t('ownerApplications.chatAwaitingReply')}</span>
        </div>
        <div className="owner-apps-inbox-actions">
          <Link className={`btn small ${focusChat ? 'primary' : 'ghost'}`} to="/wnioski?focus=chat">
            <span className="owner-apps-tab-icon" aria-hidden>
              <MessageCircleMore size={16} strokeWidth={2.1} />
            </span>
            <span>{openChatPlain}</span>
          </Link>
          <Link className={`btn small ${focusChat ? 'ghost' : 'primary'}`} to="/wnioski">
            <span className="owner-apps-tab-icon" aria-hidden>
              <ClipboardList size={16} strokeWidth={2.1} />
            </span>
            <span>{t('ownerApplications.title')}</span>
          </Link>
        </div>
      </section>

      {banner ? (
        <p className={banner.type === 'success' ? 'owner-apps-banner owner-apps-banner--ok' : 'form-error'} role="status">
          {banner.text}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}
      {err ? <p className="form-error">{err}</p> : null}

      {!loading && !err && filteredRows.length === 0 ? (
        <section className="card pad-lg owner-apps-empty-state" aria-live="polite">
          <div className="owner-apps-empty-icon" aria-hidden>
            <MessageCircleMore size={38} strokeWidth={2.1} />
          </div>
          <strong className="owner-apps-empty-title">{carFilter ? t('ownerApplications.emptyFiltered') : t('ownerApplications.empty')}</strong>
          <p className="muted owner-apps-empty-lead">{t('ownerApplications.emptyHint')}</p>
        </section>
      ) : null}

      <div className="owner-apps-desktop-inbox card">
        <aside className="owner-apps-desktop-list">
          <ul className="owner-apps-desktop-items">
            {filteredRows.map((app) => {
              const plate = app.car?.plate_number != null ? String(app.car.plate_number) : '—'
              const active = String(app.id) === String(selectedAppId)
              const st = String(app.status || 'pending')
              return (
                <li key={`desk-${app.id}`}>
                  <button
                    type="button"
                    className={`owner-apps-desktop-item${active ? ' owner-apps-desktop-item--active' : ''}`}
                    onClick={() => setSelectedAppId(String(app.id))}
                  >
                    <strong>{plate}</strong>
                    <span className="muted small">{String(app.driver_name || app.driver?.full_name || '—')}</span>
                    <span className={`status-pill status-pill--${st}`}>{st}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
        <section className="owner-apps-desktop-preview pad-lg">
          {selectedApp ? (
            <article className="owner-app-card owner-app-card--desktop-preview">
              {renderAppCard(selectedApp)}
              {selectedApp.driver_message ? <p className="owner-app-msg">{String(selectedApp.driver_message)}</p> : null}
            </article>
          ) : (
            <p className="muted small">{t('ownerApplications.empty')}</p>
          )}
        </section>
      </div>

      <div className="owner-apps-groups owner-apps-groups--mobile">
        {grouped.map((g) => {
          const plate = g.car?.plate_number != null ? String(g.car.plate_number) : '—'
          const title = [g.car?.model, g.car?.year].filter(Boolean).join(' ')
          return (
            <section key={String(g.apps[0]?.car_id ?? plate)} className="owner-apps-group card pad-lg">
              <header className="owner-apps-group-head">
                <strong>{plate}</strong>
                {title ? <span className="muted small">{title}</span> : null}
              </header>
              <ul className="owner-apps-cards">
                {g.apps.map((app) => {
                  const st = String(app.status || 'pending')
                  const needsChat = Boolean(carFilter) && String(app.status || '') === 'pending' && chatReplyIds.has(String(app.id))
                  return (
                    <li key={app.id} className={`owner-app-card${needsChat ? ' owner-app-card--chat-ping' : ''}`}>
                      {renderAppCard(app, { compact: true })}
                      {app.driver_message ? <p className="owner-app-msg">{String(app.driver_message)}</p> : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

    </div>
  )
}
