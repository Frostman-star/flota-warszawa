import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useOwnerPendingEmploymentRequestCount } from '../hooks/useOwnerPendingEmploymentRequestCount'

export function OwnerEmploymentRequests() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { refresh: refreshCount } = useOwnerPendingEmploymentRequestCount(user?.id, Boolean(user?.id))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [banner, setBanner] = useState(/** @type {{ type: 'success' | 'error'; text: string } | null} */ (null))
  const [busyId, setBusyId] = useState(/** @type {string | null} */ (null))

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from('driver_employment_requests')
      .select(
        `
        id,
        kind,
        reason_code,
        reason_note,
        status,
        created_at,
        car:cars ( plate_number ),
        driver:profiles!driver_id ( full_name, phone )
      `
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80)
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

  const respond = useCallback(
    async (requestId, action) => {
      setBusyId(requestId)
      setBanner(null)
      try {
        const { error } = await supabase.rpc('owner_respond_employment_request', {
          p_request_id: requestId,
          p_action: action,
        })
        if (error) throw error
        setBanner({ type: 'success', text: t('employmentRequests.respondSuccess') })
        await load()
        void refreshCount()
      } catch (e) {
        console.error(e)
        setBanner({ type: 'error', text: e?.message ?? String(e) })
      } finally {
        setBusyId(null)
      }
    },
    [load, refreshCount, t]
  )

  return (
    <div className="page-simple owner-employment-page">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← {t('app.panel')}
        </Link>
      </p>
      <h1>{t('employmentRequests.title')}</h1>
      <p className="muted">{t('employmentRequests.lead')}</p>

      {banner ? (
        <p className={banner.type === 'success' ? 'owner-apps-banner owner-apps-banner--ok' : 'form-error'} role="status">
          {banner.text}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}
      {err ? <p className="form-error">{err}</p> : null}

      {!loading && !err && rows.length === 0 ? <p className="muted">{t('employmentRequests.empty')}</p> : null}

      <ul className="owner-employment-list">
        {rows.map((row) => {
          const plate = row.car?.plate_number != null ? String(row.car.plate_number) : '—'
          const driverName = row.driver?.full_name != null ? String(row.driver.full_name) : '—'
          const phone = row.driver?.phone != null ? String(row.driver.phone).trim() : ''
          const st = String(row.status || '')
          const kindKey = String(row.kind || '') === 'terminate' ? 'kindTerminate' : 'kindChangeIntent'
          const reasonLabel = t(`employmentRequest.reasons.${String(row.reason_code || '')}`, {
            defaultValue: String(row.reason_code || ''),
          })
          const pending = st === 'pending_owner'
          return (
            <li key={row.id} className="card pad-lg owner-employment-card">
              <div className="owner-employment-card-head">
                <strong>{plate}</strong>
                <span
                  className={`status-pill status-pill--${
                    pending ? 'pending' : st === 'completed' ? 'accepted' : st === 'rejected_by_owner' ? 'rejected' : 'pending'
                  }`}
                >
                  {t(`employmentRequests.status.${st}`)}
                </span>
              </div>
              <p className="muted small">
                {t('employmentRequests.driver')}: {driverName}
                {phone ? ` · ${phone}` : ''}
              </p>
              <p className="muted small">
                {t(`employmentRequests.${kindKey}`)} · {t('employmentRequests.reason')}: {reasonLabel}
              </p>
              {row.reason_note ? <p className="owner-employment-note">{String(row.reason_note)}</p> : null}
              <p className="muted tiny">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</p>
              {pending ? (
                <div className="owner-app-actions">
                  {String(row.kind) === 'terminate' ? (
                    <>
                      <button
                        type="button"
                        className="btn small owner-app-accept"
                        disabled={Boolean(busyId)}
                        onClick={() => void respond(row.id, 'confirm_release')}
                      >
                        {busyId === row.id ? t('employmentRequests.busy') : t('employmentRequests.confirmRelease')}
                      </button>
                      <button
                        type="button"
                        className="btn small ghost owner-app-reject"
                        disabled={Boolean(busyId)}
                        onClick={() => void respond(row.id, 'reject_release')}
                      >
                        {busyId === row.id ? t('employmentRequests.busy') : t('employmentRequests.rejectRelease')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn small owner-app-accept"
                        disabled={Boolean(busyId)}
                        onClick={() => void respond(row.id, 'acknowledge_intent')}
                      >
                        {busyId === row.id ? t('employmentRequests.busy') : t('employmentRequests.acknowledgeIntent')}
                      </button>
                      <button
                        type="button"
                        className="btn small ghost owner-app-reject"
                        disabled={Boolean(busyId)}
                        onClick={() => void respond(row.id, 'reject_release')}
                      >
                        {busyId === row.id ? t('employmentRequests.busy') : t('employmentRequests.rejectRelease')}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
