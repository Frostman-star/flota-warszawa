import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { carPath } from '../lib/carPaths'
import { CarFormModal } from '../components/CarFormModal'
import { FleetDocDots } from '../components/FleetDocDots'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useDrivers } from '../hooks/useDrivers'
import { useAuth } from '../context/AuthContext'
import { localeTag } from '../utils/localeTag'

export function Fleet() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { cars, loading, error, refresh } = useOutletContext()
  const { isAdmin, user } = useAuth()
  const { drivers } = useDrivers(isAdmin, user?.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  /** @type {[Record<string, number>, import('react').Dispatch<import('react').SetStateAction<Record<string, number>>>]} */
  const [pendingByCarId, setPendingByCarId] = useState({})

  useEffect(() => {
    const ids = (cars ?? []).map((c) => c.id).filter(Boolean)
    if (!ids.length || !user?.id) {
      setPendingByCarId({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('driver_applications')
        .select('car_id')
        .eq('status', 'pending')
        .eq('owner_id', user.id)
        .in('car_id', ids)
      if (cancelled) return
      if (error) {
        console.error(error)
        setPendingByCarId({})
        return
      }
      const m = {}
      for (const row of data ?? []) {
        const id = String(row.car_id)
        m[id] = (m[id] ?? 0) + 1
      }
      setPendingByCarId(m)
    })()
    return () => {
      cancelled = true
    }
  }, [cars, user?.id])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = [...cars]
    if (s) {
      out = out.filter((c) => String(c.plate_number ?? '').toLowerCase().includes(s) || String(c.driver_name ?? '').toLowerCase().includes(s))
    }
    out.sort((a, b) => String(a.plate_number).localeCompare(String(b.plate_number), 'pl'))
    return out
  }, [cars, q])

  async function handleDelete(car) {
    if (!window.confirm(t('fleet.confirmDelete', { plate: car.plate_number }))) return
    if (!user?.id) return
    const { error: delErr } = await supabase.from('cars').delete().eq('id', car.id).eq('owner_id', user.id)
    if (delErr) return alert(delErr.message)
    refresh?.()
  }

  if (loading) return <div className="page-simple"><LoadingSpinner /></div>
  if (error) return <div className="page-simple"><p className="form-error">{error}</p><button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>{t('app.refresh')}</button></div>

  return (
    <div className="page-simple">
      <p className="muted small"><Link to="/panel" className="link">← {t('app.panel')}</Link></p>
      <h1>{t('fleet.title')}</h1>
      <input className="input input-xl fleet-search-simple" type="search" placeholder={t('fleet.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('app.search')} />
      <div className="car-card-grid">
        {list.map((car) => {
          const pendingCount = pendingByCarId[String(car.id)] ?? 0
          return (
            <article key={car.id} className="car-tile">
              <Link to={carPath(String(car.id), true)} className="car-tile-link">
                {pendingCount > 0 ? (
                  <span className="fleet-pending-badge" aria-label={t('fleet.pendingApplicationsBadge', { count: pendingCount })}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                ) : null}
                <div className="car-mobile-card-head">
                  <p className="car-tile-plate">{car.plate_number}</p>
                  <p className="car-tile-rent">{Number(car.weekly_rent_pln ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}<span className="car-tile-rent-suffix"> {t('fleet.rentSuffix')}</span></p>
                </div>
                <p className="car-mobile-meta">{car.model || '—'} · {car.driver_name ?? '—'}</p>
                <FleetDocDots car={car} />
              </Link>
              <div className="car-tile-actions">
                <button type="button" className="btn btn-tile ghost" onClick={() => { setEditing(car); setModalOpen(true) }}>{t('fleet.edit')}</button>
                <button type="button" className="btn btn-tile danger" onClick={() => handleDelete(car)}>{t('fleet.delete')}</button>
              </div>
            </article>
          )
        })}
      </div>
      <CarFormModal open={modalOpen} onClose={() => setModalOpen(false)} car={editing} drivers={drivers} onSaved={() => refresh?.()} />
    </div>
  )
}
