import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { carPath } from '../lib/carPaths'
import { useAuth } from '../context/AuthContext'
import { useCar } from '../hooks/useCars'
import { useCarHistory } from '../hooks/useCarHistory'
import { useDriverCar } from '../hooks/useDriverCar'
import { CarFormModal } from '../components/CarFormModal'
import { CarStatusBadge } from '../components/CarStatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { NoteModal } from '../components/NoteModal'
import { useDrivers } from '../hooks/useDrivers'
import { DOC_LABELS } from '../utils/documents'
import { expiryStatusLabel, serviceStatusLabel } from '../utils/docLabels'

export function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const { drivers } = useDrivers(isAdmin)
  const { carId: assignedCarId } = useDriverCar(!isAdmin ? user?.id : null)

  const { car, loading, error, refresh } = useCar(id ?? null, {
    userId: isAdmin ? null : user?.id,
  })
  const { entries, loading: histLoading, refresh: refreshHist } = useCarHistory(car?.id ?? null)

  const [mileageVal, setMileageVal] = useState('')
  const [mileBusy, setMileBusy] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [formErr, setFormErr] = useState(null)

  if (!isAdmin && assignedCarId && id && id !== assignedCarId) {
    return <Navigate to={carPath(assignedCarId, false)} replace />
  }

  if (loading) {
    return (
      <div className="page-simple">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="page-simple">
        <p className="form-error">{error ?? 'Brak auta.'}</p>
        <button type="button" className="btn btn-huge ghost" onClick={() => navigate(isAdmin ? '/flota' : '/')}>
          Wróć
        </button>
      </div>
    )
  }

  async function saveMileage() {
    const next = Number(mileageVal)
    if (!Number.isFinite(next) || next < 0) {
      setFormErr('Podaj poprawny przebieg')
      return
    }
    setMileBusy(true)
    setFormErr(null)
    const prev = Number(car.mileage_km ?? 0)
    try {
      const { error: u } = await supabase.from('cars').update({ mileage_km: next }).eq('id', car.id)
      if (u) throw u
      const { error: h } = await supabase.from('car_history').insert({
        car_id: car.id,
        event_type: 'mileage',
        previous_mileage: prev,
        new_mileage: next,
        detail: `Przebieg: ${prev} → ${next} km`,
        created_by: user?.id ?? null,
      })
      if (h) throw h
      setMileageVal('')
      await refresh()
      await refreshHist()
    } catch (e) {
      setFormErr(e.message ?? 'Błąd')
    } finally {
      setMileBusy(false)
    }
  }

  async function saveNote(text) {
    const stamp = new Date().toLocaleString('pl-PL')
    const next = `${car.notes ? `${car.notes.trim()}\n\n` : ''}[${stamp}] ${text.trim()}`
    const { error: u } = await supabase.from('cars').update({ notes: next }).eq('id', car.id)
    if (u) throw u
    await refresh()
  }

  async function saveMarketplace(patch) {
    const { error: u } = await supabase.from('cars').update(patch).eq('id', car.id)
    if (u) throw u
    await refresh()
  }

  const docKeys = [
    { key: 'oc_expiry', label: DOC_LABELS.oc_expiry },
    { key: 'ac_expiry', label: DOC_LABELS.ac_expiry },
    { key: 'przeglad_expiry', label: DOC_LABELS.przeglad_expiry },
    { key: 'last_service_date', label: 'Serwis (ostatni)' },
  ]

  return (
    <div className="page-simple car-detail-simple">
      <p className="muted small">
        {isAdmin ? (
          <Link to="/flota" className="link">
            ← Moje auta
          </Link>
        ) : null}
      </p>

      <header className="detail-header-simple">
        <h1>{car.plate_number}</h1>
        <p className="muted lead">{car.model || '—'}</p>
        <p className="detail-line">
          <strong>Kierowca:</strong> {car.driver_name ?? '—'}
        </p>
        <p className="detail-line">
          <strong>Czynsz:</strong>{' '}
          {Number(car.weekly_rent_pln ?? 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}{' '}
          <span className="muted">/ tydzień</span>
        </p>
        <CarStatusBadge car={car} />
      </header>

      <section className="detail-block">
        <h2>Dokumenty</h2>
        <ul className="doc-simple-list">
          {docKeys.map(({ key, label }) => {
            const date = car[key]
            const st =
              key === 'last_service_date'
                ? serviceStatusLabel(typeof date === 'string' ? date : null)
                : expiryStatusLabel(typeof date === 'string' ? date : null)
            return (
              <li key={key} className="doc-simple-row">
                <div>
                  <p className="doc-simple-name">{label}</p>
                  <p className="muted">{date ? String(date) : '—'}</p>
                </div>
                <span className={`status-pill tone-${st.tone}`}>{st.text}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {isAdmin ? (
        <>
          <section className="detail-block">
            <h2>Przebieg</h2>
            <p className="big-reading">{Number(car.mileage_km ?? 0).toLocaleString('pl-PL')} km</p>
            {formErr ? <p className="form-error">{formErr}</p> : null}
            <div className="mile-inline">
              <input
                className="input input-xl"
                type="number"
                min={0}
                placeholder="Nowy stan licznika"
                value={mileageVal}
                onChange={(e) => setMileageVal(e.target.value)}
              />
              <button type="button" className="btn btn-huge primary" disabled={mileBusy} onClick={saveMileage}>
                Zapisz
              </button>
            </div>
          </section>

          <section className="detail-block actions-stack">
            <button type="button" className="btn btn-huge secondary" onClick={() => setNoteOpen(true)}>
              Dodaj notatkę
            </button>
            <button type="button" className="btn btn-huge secondary" onClick={() => setEditOpen(true)}>
              Edytuj auto
            </button>
          </section>

          <section className="detail-block">
            <h2>Marketplace</h2>
            <label className="field checkbox-line">
              <input
                type="checkbox"
                checked={Boolean(car.show_in_marketplace)}
                onChange={(e) => saveMarketplace({ show_in_marketplace: e.target.checked })}
              />
              <span>Pokaż na marketplace</span>
            </label>
            <div className="chip-row" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className={car.marketplace_status === 'dostepne' ? 'chip active' : 'chip'}
                onClick={() => saveMarketplace({ marketplace_status: 'dostepne' })}
              >
                Dostępne
              </button>
              <button
                type="button"
                className={car.marketplace_status === 'zajete' ? 'chip active' : 'chip'}
                onClick={() => saveMarketplace({ marketplace_status: 'zajete' })}
              >
                Zajęte
              </button>
            </div>
          </section>
        </>
      ) : null}

      <section className="detail-block">
        <h2>Ostatnie wpisy</h2>
        {histLoading ? (
          <LoadingSpinner />
        ) : (
          <ul className="mini-hist">
            {entries.slice(0, 5).map((e) => (
              <li key={e.id} className="muted small">
                {new Date(e.created_at).toLocaleDateString('pl-PL')} — {e.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={saveNote} />
      <CarFormModal open={editOpen} onClose={() => setEditOpen(false)} car={car} drivers={drivers} onSaved={() => refresh()} />
    </div>
  )
}
