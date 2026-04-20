import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { carPath } from '../lib/carPaths'
import { buildAlertRows, formatDaysLabel } from '../utils/fleetMetrics'

/**
 * @param {{ cars?: Array<Record<string, unknown>> }} props
 */
export function NotificationBell({ cars = [] }) {
  const { t } = useTranslation()
  const { isAdmin, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [appRows, setAppRows] = useState([])

  const loadAppNotifications = useCallback(async () => {
    if (!user?.id) {
      setAppRows([])
      return
    }
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, kind, payload, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(24)
    if (error) {
      console.error(error)
      setAppRows([])
      return
    }
    setAppRows(data ?? [])
  }, [user?.id])

  useEffect(() => {
    loadAppNotifications()
  }, [loadAppNotifications])

  const markAppRead = useCallback(async () => {
    if (!user?.id) return
    await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    await loadAppNotifications()
  }, [user?.id, loadAppNotifications])

  const docRows = useMemo(() => buildAlertRows(cars).slice(0, 12), [cars])
  const docCount = useMemo(() => buildAlertRows(cars).length, [cars])
  const unreadApp = useMemo(() => appRows.filter((r) => !r.read_at).length, [appRows])
  const totalCount = docCount + unreadApp

  function appNotifHref(row) {
    const kind = String(row.kind || '')
    if (kind === 'driver_application_new') return '/wnioski'
    if (kind === 'application_accepted' || kind === 'application_rejected') return '/moje-wnioski'
    if (kind === 'driver_employment_request_new') return '/zapytania-kierowcow'
    if (
      kind === 'driver_employment_released' ||
      kind === 'driver_employment_request_rejected' ||
      kind === 'driver_employment_intent_acknowledged'
    ) {
      return '/profil'
    }
    return isAdmin ? '/panel' : '/marketplace'
  }

  function appNotifTitle(row) {
    const kind = String(row.kind || '')
    const plate = row.payload?.plate != null ? String(row.payload.plate) : ''
    if (kind === 'driver_application_new') return t('notifications.appNewApplication', { plate })
    if (kind === 'application_accepted') return t('notifications.appAccepted', { plate })
    if (kind === 'application_rejected') return t('notifications.appRejected', { plate })
    if (kind === 'driver_employment_request_new') return t('notifications.empRequestNew', { plate })
    if (kind === 'driver_employment_released') return t('notifications.empReleased', { plate })
    if (kind === 'driver_employment_request_rejected') return t('notifications.empRequestRejected', { plate })
    if (kind === 'driver_employment_intent_acknowledged') return t('notifications.empIntentAcknowledged', { plate })
    return t('notifications.appGeneric')
  }

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        className="notif-bell-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('notifications.bellAria', { count: totalCount })}
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) void markAppRead()
            return next
          })
        }}
      >
        <span className="notif-icon" aria-hidden>
          🔔
        </span>
        {totalCount > 0 ? (
          <span className="notif-badge" aria-hidden>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="notif-dismiss" aria-label={t('app.close')} onClick={() => setOpen(false)} />
          <div className="notif-popover" role="menu">
            <header className="notif-pop-head">
              <strong>{t('notifications.title')}</strong>
              <span className="muted small">{totalCount}</span>
            </header>
            {appRows.length === 0 && docRows.length === 0 ? (
              <p className="muted notif-empty">{t('notifications.empty')}</p>
            ) : (
              <ul className="notif-list">
                {appRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      to={appNotifHref(row)}
                      className="notif-item"
                      onClick={() => {
                        setOpen(false)
                      }}
                    >
                      <span className={`notif-dot${row.read_at ? '' : ' notif-dot--unread'}`} aria-hidden />
                      <div>
                        <div className="notif-line">
                          <span className="notif-plate">{appNotifTitle(row)}</span>
                        </div>
                        <div className="muted small">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
                {docRows.map((r) => (
                  <li key={`${r.carId}-${r.docLabel}-${r.date}`}>
                    <Link
                      to={carPath(r.carId, isAdmin)}
                      className={`notif-item tier-border-${r.tier}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className={`notif-dot tier-bg-${r.tier}`} aria-hidden />
                      <div>
                        <div className="notif-line">
                          <span className="notif-plate">{r.plate}</span>
                          <span className="muted small">{r.docLabel}</span>
                        </div>
                        <div className="muted small">{formatDaysLabel(r.date)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <footer className="notif-foot">
              {isAdmin ? (
                <Link to="/panel" className="link" onClick={() => setOpen(false)}>
                  {t('app.panel')}
                </Link>
              ) : cars[0]?.id ? (
                <Link to={carPath(String(cars[0].id), isAdmin)} className="link" onClick={() => setOpen(false)}>
                  {t('fleet.title')}
                </Link>
              ) : (
                <Link to="/marketplace" className="link" onClick={() => setOpen(false)}>
                  {t('nav.marketplace')}
                </Link>
              )}
            </footer>
          </div>
        </>
      ) : null}
    </div>
  )
}
