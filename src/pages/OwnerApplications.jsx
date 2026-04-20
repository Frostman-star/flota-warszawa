import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DriverProfileCard } from '../components/DriverProfileCard'

export function OwnerApplications() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [banner, setBanner] = useState(/** @type {{ type: 'success' | 'error'; text: string } | null} */ (null))
  /** @type {[string | null, import('react').Dispatch<import('react').SetStateAction<string | null>>]} */
  const [actionBusyId, setActionBusyId] = useState(null)

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

  const acceptApplication = useCallback(
    async (applicationId) => {
      setActionBusyId(applicationId)
      setBanner(null)
      try {
        const { data: existing, error: peekErr } = await supabase.rpc('get_driver_current_assignment_for_application', {
          p_application_id: applicationId,
        })
        if (peekErr) throw peekErr
        const row = Array.isArray(existing) ? existing[0] : null
        const otherPlate = row?.plate != null ? String(row.plate).trim() : ''
        if (otherPlate) {
          const ok = window.confirm(t('ownerApplications.reassignBody', { plate: otherPlate }))
          if (!ok) {
            setActionBusyId(null)
            return
          }
        }
        const { error } = await supabase.rpc('accept_driver_application', { p_application_id: applicationId })
        if (error) throw error
        setBanner({ type: 'success', text: t('ownerApplications.acceptSuccess') })
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
    for (const r of rows) {
      const cid = String(r.car_id ?? '')
      if (!m.has(cid)) m.set(cid, { car: r.car, apps: [] })
      m.get(cid).apps.push(r)
    }
    return [...m.values()]
  }, [rows])

  return (
    <div className="page-simple owner-apps-page">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← {t('app.panel')}
        </Link>
      </p>
      <h1>{t('ownerApplications.title')}</h1>
      <p className="muted">{t('ownerApplications.lead')}</p>

      {banner ? (
        <p className={banner.type === 'success' ? 'owner-apps-banner owner-apps-banner--ok' : 'form-error'} role="status">
          {banner.text}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}
      {err ? <p className="form-error">{err}</p> : null}

      {!loading && !err && rows.length === 0 ? <p className="muted">{t('ownerApplications.empty')}</p> : null}

      <div className="owner-apps-groups">
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
                  const leadClass =
                    lead === 'cario_marketplace'
                      ? 'owner-app-lead owner-app-lead--marketplace'
                      : 'owner-app-lead owner-app-lead--other'
                  const st = String(app.status || 'pending')
                  const statusLabel =
                    st === 'accepted'
                      ? t('driverApplications.statusAccepted')
                      : st === 'rejected'
                        ? t('driverApplications.statusRejected')
                        : t('driverApplications.statusPending')
                  return (
                    <li key={app.id} className="owner-app-card">
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
                      {app.driver_message ? <p className="owner-app-msg">{String(app.driver_message)}</p> : null}
                      <p className="muted tiny">
                        {app.created_at ? new Date(app.created_at).toLocaleString() : ''}
                      </p>
                      <div className="owner-app-actions">
                        {st === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="btn small owner-app-accept"
                              disabled={Boolean(actionBusyId)}
                              onClick={() => void acceptApplication(app.id)}
                            >
                              {actionBusyId === app.id ? t('ownerApplications.acceptBusy') : t('ownerApplications.accept')}
                            </button>
                            <button
                              type="button"
                              className="btn small ghost owner-app-reject"
                              disabled={Boolean(actionBusyId)}
                              onClick={() => void rejectApplication(app.id)}
                            >
                              {actionBusyId === app.id ? t('ownerApplications.rejectBusy') : t('ownerApplications.reject')}
                            </button>
                          </>
                        ) : null}
                        <Link className="btn ghost small" to={`/rozmowa-wniosek/${app.id}`}>
                          {t('ownerApplications.openChat')}
                        </Link>
                      </div>
                      <span className={`status-pill status-pill--${st}`}>{statusLabel}</span>
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
