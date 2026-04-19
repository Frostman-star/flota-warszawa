import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useDriverAssignedCar } from '../hooks/useDriverAssignedCar'

function statusMeta(t, status) {
  const s = String(status || '')
  if (s === 'accepted') return { label: t('driverApplications.statusAccepted'), emoji: '🟢' }
  if (s === 'rejected') return { label: t('driverApplications.statusRejected'), emoji: '🔴' }
  return { label: t('driverApplications.statusPending'), emoji: '🟡' }
}

export function DriverMyApplications() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { assignment, loading: carLoading } = useDriverAssignedCar(user?.id, Boolean(user?.id))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

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
        car:cars ( plate_number, model, year )
      `
      )
      .eq('driver_id', user.id)
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

  return (
    <div className="page-simple driver-apps-page">
      <p className="muted small">
        <Link to="/marketplace" className="link">
          ← {t('nav.marketplace')}
        </Link>
      </p>
      <h1>{t('driverApplications.title')}</h1>
      <p className="muted">{t('driverApplications.lead')}</p>

      {!carLoading ? (
        <p
          className={`driver-app-employment-badge${assignment ? ' driver-app-employment-badge--on' : ' driver-app-employment-badge--off'}`}
          role="status"
        >
          {assignment ? `${t('driverEmployment.workingBadge')} ${assignment.plate}` : t('driverEmployment.lookingBadge')}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}
      {err ? <p className="form-error">{err}</p> : null}

      {!loading && !err && rows.length === 0 ? <p className="muted">{t('driverApplications.empty')}</p> : null}

      <ul className="driver-app-list">
        {rows.map((row) => {
          const car = row.car
          const plate = car?.plate_number != null ? String(car.plate_number) : '—'
          const model = [car?.model, car?.year].filter(Boolean).join(' ')
          const sm = statusMeta(t, row.status)
          return (
            <li key={row.id} className="card pad-lg driver-app-card">
              <div className="driver-app-card-head">
                <strong className="driver-app-plate">{plate}</strong>
                <span className={`status-pill status-pill--${String(row.status)}`}>
                  {sm.emoji} {sm.label}
                </span>
              </div>
              {model ? <p className="muted small">{model}</p> : null}
              {row.driver_message ? <p className="driver-app-msg">{String(row.driver_message)}</p> : null}
              <p className="muted tiny">
                {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
