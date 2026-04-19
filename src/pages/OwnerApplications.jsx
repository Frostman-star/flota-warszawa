import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DriverProfileCard } from '../components/DriverProfileCard'
import { useOwnerPendingApplicationCount } from '../hooks/useOwnerPendingApplicationCount'

async function notifyApplicationEmail(session, payload) {
  if (!session?.access_token) return
  try {
    await supabase.functions.invoke('notify-driver-application', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch {
    /* brak wdrożonej funkcji — ignoruj */
  }
}

export function OwnerApplications() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { refresh: refreshPending } = useOwnerPendingApplicationCount(user?.id, Boolean(user?.id))

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busyId, setBusyId] = useState(null)

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
        created_at,
        driver_message,
        driver_name,
        driver_phone,
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
      .eq('status', 'pending')
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

  const grouped = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const cid = String(r.car_id ?? '')
      if (!m.has(cid)) m.set(cid, { car: r.car, apps: [] })
      m.get(cid).apps.push(r)
    }
    return [...m.values()]
  }, [rows])

  async function accept(app) {
    if (!session?.access_token) return
    setBusyId(app.id)
    setFlash(null)
    const { data: carId, error } = await supabase.rpc('accept_driver_application', { p_application_id: app.id })
    setBusyId(null)
    if (error) {
      setFlash({ type: 'err', text: error.message })
      return
    }
    await notifyApplicationEmail(session, { event: 'accepted', application_id: app.id })
    setFlash({ type: 'ok', text: t('ownerApplications.acceptedFlash') })
    await load()
    await refreshPending()
    const cid = typeof carId === 'string' ? carId : carId != null ? String(carId) : String(app.car_id ?? '')
    if (cid) {
      window.setTimeout(() => navigate(`/flota/${cid}`), 900)
    }
  }

  async function reject(app) {
    if (!session?.access_token) return
    setBusyId(app.id)
    setFlash(null)
    const { error } = await supabase.rpc('reject_driver_application', { p_application_id: app.id })
    setBusyId(null)
    if (error) {
      setFlash({ type: 'err', text: error.message })
      return
    }
    await notifyApplicationEmail(session, { event: 'rejected', application_id: app.id })
    setFlash({ type: 'info', text: t('ownerApplications.rejectedFlash') })
    setRows((prev) => prev.filter((x) => x.id !== app.id))
    await refreshPending()
    window.setTimeout(() => setFlash(null), 2000)
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

      {flash?.type === 'ok' ? <p className="form-success">{flash.text}</p> : null}
      {flash?.type === 'err' ? <p className="form-error">{flash.text}</p> : null}
      {flash?.type === 'info' ? <p className="muted">{flash.text}</p> : null}

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
                  return (
                    <li key={app.id} className="owner-app-card">
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
                        <button
                          type="button"
                          className="btn btn-huge primary owner-app-accept"
                          disabled={busyId === app.id}
                          onClick={() => void accept(app)}
                        >
                          {t('ownerApplications.accept')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-huge danger owner-app-reject"
                          disabled={busyId === app.id}
                          onClick={() => void reject(app)}
                        >
                          {t('ownerApplications.reject')}
                        </button>
                      </div>
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
