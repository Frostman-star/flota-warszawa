import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

const emptyForm = {
  plate_number: '',
  model: '',
  year: '',
  color_label: '',
  assigned_driver_id: '',
  driver_label: '',
  mileage_km: '0',
  weekly_rent_pln: '0',
  fines_count: '0',
  oc_expiry: '',
  ac_expiry: '',
  przeglad_expiry: '',
  last_service_date: '',
  notes: '',
  show_in_marketplace: false,
  marketplace_status: 'zajete',
}

/**
 * @param {{ open: boolean, onClose: () => void, car?: Record<string, unknown> | null, drivers: Array<{ id: string, full_name: string, email?: string | null }>, onSaved: () => void }} props
 */
export function CarFormModal({ open, onClose, car, drivers, onSaved }) {
  const editing = Boolean(car?.id)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (car) {
      setForm({
        plate_number: String(car.plate_number ?? ''),
        model: String(car.model ?? ''),
        year: car.year != null ? String(car.year) : '',
        color_label: String(car.color_label ?? ''),
        assigned_driver_id: car.assigned_driver_id ? String(car.assigned_driver_id) : '',
        driver_label: String(car.driver_label ?? ''),
        mileage_km: String(car.mileage_km ?? '0'),
        weekly_rent_pln: String(car.weekly_rent_pln ?? '0'),
        fines_count: String(car.fines_count ?? '0'),
        oc_expiry: car.oc_expiry ? String(car.oc_expiry) : '',
        ac_expiry: car.ac_expiry ? String(car.ac_expiry) : '',
        przeglad_expiry: car.przeglad_expiry ? String(car.przeglad_expiry) : '',
        last_service_date: car.last_service_date ? String(car.last_service_date) : '',
        notes: String(car.notes ?? ''),
        show_in_marketplace: Boolean(car.show_in_marketplace),
        marketplace_status: car.marketplace_status === 'dostepne' ? 'dostepne' : 'zajete',
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, car])

  const title = useMemo(() => (editing ? 'Edytuj pojazd' : 'Dodaj pojazd'), [editing])

  function field(name, label, type = 'text', opts = {}) {
    const { rows, placeholder, step, min } = opts
    return (
      <label className="field">
        <span className="field-label">{label}</span>
        {type === 'textarea' ? (
          <textarea
            className="input"
            rows={rows ?? 3}
            name={name}
            value={form[name]}
            placeholder={placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          />
        ) : (
          <input
            className="input"
            type={type}
            name={name}
            value={form[name]}
            placeholder={placeholder}
            step={step}
            min={min}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          />
        )}
      </label>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      plate_number: form.plate_number.trim(),
      model: form.model.trim(),
      year: form.year ? Number(form.year) : null,
      color_label: form.color_label.trim(),
      assigned_driver_id: form.assigned_driver_id || null,
      driver_label: form.driver_label.trim(),
      mileage_km: Number(form.mileage_km) || 0,
      weekly_rent_pln: Number(form.weekly_rent_pln) || 0,
      fines_count: Number(form.fines_count) || 0,
      oc_expiry: form.oc_expiry || null,
      ac_expiry: form.ac_expiry || null,
      przeglad_expiry: form.przeglad_expiry || null,
      last_service_date: form.last_service_date || null,
      notes: form.notes,
      show_in_marketplace: Boolean(form.show_in_marketplace),
      marketplace_status: form.marketplace_status,
    }

    if (!payload.plate_number) {
      setError('Numer rejestracyjny jest wymagany.')
      setSaving(false)
      return
    }

    try {
      if (editing) {
        const { error: upErr } = await supabase.from('cars').update(payload).eq('id', car.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('cars').insert(payload)
        if (insErr) throw insErr
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message ?? 'Nie udało się zapisać')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="modal-actions">
      <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
        Anuluj
      </button>
      <button type="submit" form="car-form" className="btn primary" disabled={saving}>
        {saving ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </div>
  )

  return (
    <Modal open={open} title={title} onClose={onClose} footer={footer}>
      <form id="car-form" className="form-grid" onSubmit={handleSubmit}>
        {error ? <p className="form-error">{error}</p> : null}
        {field('plate_number', 'Numer rejestracyjny *')}
        {field('model', 'Model')}
        {field('year', 'Rok produkcji', 'number', { min: 1970, step: 1 })}
        {field('color_label', 'Kolor (etykieta)')}
        <label className="field">
          <span className="field-label">Kierowca z listy (opcjonalnie)</span>
          <select
            className="input"
            value={form.assigned_driver_id}
            onChange={(e) => setForm((f) => ({ ...f, assigned_driver_id: e.target.value }))}
          >
            <option value="">— brak —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
                {d.email ? ` (${d.email})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Albo imię kierowcy (tekst)</span>
          <input
            className="input"
            value={form.driver_label}
            onChange={(e) => setForm((f) => ({ ...f, driver_label: e.target.value }))}
            placeholder="np. Jan Kowalski"
          />
        </label>
        {field('mileage_km', 'Przebieg (km)', 'number', { min: 0, step: 1 })}
        {field('weekly_rent_pln', 'Czynsz tygodniowy (PLN)', 'number', { min: 0, step: 0.01 })}
        {field('fines_count', 'Liczba mandatów', 'number', { min: 0, step: 1 })}
        {field('oc_expiry', 'OC — data ważności', 'date')}
        {field('ac_expiry', 'AC — data ważności', 'date')}
        {field('przeglad_expiry', 'Przegląd techniczny', 'date')}
        {field('last_service_date', 'Ostatni serwis', 'date')}
        {field('notes', 'Notatki', 'textarea', { rows: 4 })}
        <label className="field checkbox-line">
          <input
            type="checkbox"
            checked={Boolean(form.show_in_marketplace)}
            onChange={(e) => setForm((f) => ({ ...f, show_in_marketplace: e.target.checked }))}
          />
          <span>Pokaż na marketplace</span>
        </label>
        <label className="field">
          <span className="field-label">Status na marketplace</span>
          <select
            className="input"
            value={form.marketplace_status}
            onChange={(e) => setForm((f) => ({ ...f, marketplace_status: e.target.value }))}
          >
            <option value="zajete">Zajęte</option>
            <option value="dostepne">Dostępne</option>
          </select>
        </label>
      </form>
    </Modal>
  )
}
