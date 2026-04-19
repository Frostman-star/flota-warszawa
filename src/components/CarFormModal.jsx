import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { shouldUseLegacyAssignedDriverColumn, toLegacyCarWritePayload } from '../utils/carDriverSchema'
import { Modal } from './Modal'

const emptyForm = {
  plate_number: '',
  model: '',
  year: '',
  color_label: '',
  driver_id: '',
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
 * @param {{ open: boolean, onClose: () => void, car?: Record<string, unknown> | null, drivers: Array<{ id: string, full_name: string, email?: string | null, assigned_to_car_id?: string | null }>, onSaved: () => void }} props
 */
export function CarFormModal({ open, onClose, car, drivers, onSaved }) {
  const { t } = useTranslation()
  const editing = Boolean(car?.id)
  const editingCarId = car?.id ? String(car.id) : null
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
        driver_id: (() => {
          const d = car.driver_id ?? car.assigned_driver_id
          return d ? String(d) : ''
        })(),
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

  const title = useMemo(() => (editing ? t('carForm.editTitle') : t('carForm.addTitle')), [editing, t])

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
      driver_id: form.driver_id || null,
      driver_label: '',
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
      setError(t('carForm.plateRequired'))
      setSaving(false)
      return
    }

    try {
      if (editing) {
        let { error: upErr } = await supabase.from('cars').update(payload).eq('id', car.id)
        if (upErr && shouldUseLegacyAssignedDriverColumn(upErr)) {
          ;({ error: upErr } = await supabase.from('cars').update(toLegacyCarWritePayload(payload)).eq('id', car.id))
        }
        if (upErr) throw upErr
      } else {
        let { error: insErr } = await supabase.from('cars').insert(payload)
        if (insErr && shouldUseLegacyAssignedDriverColumn(insErr)) {
          ;({ error: insErr } = await supabase.from('cars').insert(toLegacyCarWritePayload(payload)))
        }
        if (insErr) throw insErr
      }
      onSaved()
      onClose()
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      if (code === '23505') {
        setError(t('carForm.driverTakenError'))
      } else {
        setError(err.message ?? t('carForm.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="modal-actions">
      <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
        {t('carForm.cancel')}
      </button>
      <button type="submit" form="car-form" className="btn primary" disabled={saving}>
        {saving ? t('carForm.saving') : t('carForm.save')}
      </button>
    </div>
  )

  return (
    <Modal open={open} title={title} onClose={onClose} footer={footer}>
      <form id="car-form" className="form-grid" onSubmit={handleSubmit}>
        {error ? <p className="form-error">{error}</p> : null}
        {field('plate_number', t('carForm.plate'))}
        {field('model', t('carForm.model'))}
        {field('year', t('carForm.year'), 'number', { min: 1970, step: 1 })}
        {field('color_label', t('carForm.color'))}
        <label className="field">
          <span className="field-label">{t('carForm.driverSelect')}</span>
          <select
            className="input"
            value={form.driver_id}
            onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
          >
            <option value="">{t('carForm.driverNone')}</option>
            {drivers.map((d) => {
              const busyElsewhere = Boolean(d.assigned_to_car_id && d.assigned_to_car_id !== editingCarId)
              const label = `${d.full_name || '—'}${d.email ? ` · ${d.email}` : ''}${busyElsewhere ? ` ${t('carForm.driverBusySuffix')}` : ''}`
              return (
                <option key={d.id} value={d.id} disabled={busyElsewhere}>
                  {label}
                </option>
              )
            })}
          </select>
        </label>
        {field('mileage_km', t('carForm.mileage'), 'number', { min: 0, step: 1 })}
        {field('weekly_rent_pln', t('carForm.rent'), 'number', { min: 0, step: 0.01 })}
        {field('fines_count', t('carForm.fines'), 'number', { min: 0, step: 1 })}
        {field('oc_expiry', t('carForm.oc'), 'date')}
        {field('ac_expiry', t('carForm.ac'), 'date')}
        {field('przeglad_expiry', t('carForm.prz'), 'date')}
        {field('last_service_date', t('carForm.service'), 'date')}
        {field('notes', t('carForm.notes'), 'textarea', { rows: 4 })}
        <label className="field checkbox-line">
          <input
            type="checkbox"
            checked={Boolean(form.show_in_marketplace)}
            onChange={(e) => setForm((f) => ({ ...f, show_in_marketplace: e.target.checked }))}
          />
          <span>{t('carForm.showMarketplace')}</span>
        </label>
        <label className="field">
          <span className="field-label">{t('carForm.marketplaceStatus')}</span>
          <select
            className="input"
            value={form.marketplace_status}
            onChange={(e) => setForm((f) => ({ ...f, marketplace_status: e.target.value }))}
          >
            <option value="zajete">{t('carForm.statusOptionTaken')}</option>
            <option value="dostepne">{t('carForm.statusOptionAvailable')}</option>
          </select>
        </label>
      </form>
    </Modal>
  )
}
