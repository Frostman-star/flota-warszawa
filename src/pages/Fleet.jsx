import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { carPath } from '../lib/carPaths'
import { CarFormModal } from '../components/CarFormModal'
import { FleetDocDots } from '../components/FleetDocDots'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useDrivers } from '../hooks/useDrivers'
import { useAuth } from '../context/AuthContext'
import { tierForExpiry, tierForServiceDot } from '../utils/documents'

function isAllOk(car) {
  const parts = []
  for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
    const t = tierForExpiry(car[key])
    if (t) parts.push(t)
  }
  const st = tierForServiceDot(typeof car.last_service_date === 'string' ? car.last_service_date : null)
  if (st) parts.push(st)
  if (!parts.length) return false
  return parts.every((t) => t === 'green')
}

export function Fleet() {
  const { cars, loading, error, refresh } = useOutletContext()
  const { isAdmin } = useAuth()
  const { drivers } = useDrivers(isAdmin)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = [...cars]
    if (s) {
      out = out.filter((c) => {
        const plate = String(c.plate_number ?? '').toLowerCase()
        const drv = String(c.driver_name ?? '').toLowerCase()
        return plate.includes(s) || drv.includes(s)
      })
    }
    out.sort((a, b) => String(a.plate_number).localeCompare(String(b.plate_number), 'pl'))
    return out
  }, [cars, q])

  async function handleDelete(car) {
    if (!window.confirm(`Usunąć ${car.plate_number}?`)) return
    const { error: delErr } = await supabase.from('cars').delete().eq('id', car.id)
    if (delErr) {
      alert(delErr.message)
      return
    }
    refresh?.()
  }

  if (loading) {
    return (
      <div className="page-simple">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-simple">
        <p className="form-error">{error}</p>
        <button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>
          Odśwież
        </button>
      </div>
    )
  }

  return (
    <div className="page-simple">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← Panel
        </Link>
      </p>
      <h1>Moje auta</h1>
      <input
        className="input input-xl fleet-search-simple"
        type="search"
        placeholder="Szukaj po rejestracji lub kierowcy…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Szukaj"
      />

      <div className="car-card-grid">
        {list.map((car) => {
          const ok = isAllOk(car)
          return (
            <article key={car.id} className="car-tile">
              <Link to={carPath(String(car.id), true)} className="car-tile-link">
                <div className="car-mobile-card-head">
                  <p className="car-tile-plate">{car.plate_number}</p>
                  <p className="car-tile-rent">
                    {Number(car.weekly_rent_pln ?? 0).toLocaleString('pl-PL', {
                      style: 'currency',
                      currency: 'PLN',
                    })}
                    <span className="car-tile-rent-suffix"> / tydz.</span>
                  </p>
                </div>
                <p className="car-mobile-meta">
                  {car.model || '—'} · {car.driver_name ?? '—'}
                </p>
                <FleetDocDots car={car} />
                <div className={`car-tile-badge ${ok ? 'ok' : 'warn'}`}>{ok ? '🟢 OK' : '🔴 Sprawdź'}</div>
              </Link>
              <div className="car-tile-actions">
                <button
                  type="button"
                  className="btn btn-tile ghost"
                  onClick={() => {
                    setEditing(car)
                    setModalOpen(true)
                  }}
                >
                  Edytuj
                </button>
                <button type="button" className="btn btn-tile danger" onClick={() => handleDelete(car)}>
                  Usuń
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <CarFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        car={editing}
        drivers={drivers}
        onSaved={() => refresh?.()}
      />
    </div>
  )
}
