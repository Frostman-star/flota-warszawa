import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { carPath } from '../lib/carPaths'
import { buildAlertRows, formatDaysLabel } from '../utils/fleetMetrics'

export function NotificationBell({ cars }) {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => buildAlertRows(cars).slice(0, 12), [cars])
  const count = useMemo(() => buildAlertRows(cars).length, [cars])

  return (
    <div className="notif-bell-wrap">
      <button type="button" className="notif-bell-btn" aria-expanded={open} aria-haspopup="true" aria-label={`Notifications, ${count}`} onClick={() => setOpen((v) => !v)}>
        <span className="notif-icon" aria-hidden>🔔</span>
        {count > 0 ? <span className="notif-badge" aria-hidden>{count > 99 ? '99+' : count}</span> : null}
      </button>
      {open ? (
        <>
          <button type="button" className="notif-dismiss" aria-label={t('app.close')} onClick={() => setOpen(false)} />
          <div className="notif-popover" role="menu">
            <header className="notif-pop-head"><strong>Document alerts</strong><span className="muted small">{count}</span></header>
            {rows.length === 0 ? <p className="muted notif-empty">No alerts in 30-day window.</p> : (
              <ul className="notif-list">
                {rows.map((r) => (
                  <li key={`${r.carId}-${r.docLabel}-${r.date}`}>
                    <Link to={carPath(r.carId, isAdmin)} className={`notif-item tier-border-${r.tier}`} onClick={() => setOpen(false)}>
                      <span className={`notif-dot tier-bg-${r.tier}`} aria-hidden />
                      <div><div className="notif-line"><span className="notif-plate">{r.plate}</span><span className="muted small">{r.docLabel}</span></div><div className="muted small">{formatDaysLabel(r.date)}</div></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <footer className="notif-foot">
              {isAdmin ? <Link to="/panel" className="link" onClick={() => setOpen(false)}>{t('app.panel')}</Link> : cars[0]?.id ? <Link to={carPath(String(cars[0].id), isAdmin)} className="link" onClick={() => setOpen(false)}>{t('fleet.title')}</Link> : null}
            </footer>
          </div>
        </>
      ) : null}
    </div>
  )
}
