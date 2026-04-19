import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { shouldUseLegacyAssignedDriverColumn, toLegacyCarWritePayload } from '../utils/carDriverSchema'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { TAXI_APP_ORDER, normalizeAppsAvailable } from '../utils/partnerApps'
import { Modal } from './Modal'
import { MarketplaceListingFields } from './MarketplaceListingFields'

const PARTNER_NAME_HINTS = ['Promin', 'Qiwi', 'Spark', 'Fleet Partner', 'Inny']

const emptyForm = {
  plate_number: '',
  model: '',
  year: '',
  color_label: '',
  driver_id: '',
  mileage_km: '0',
  weekly_rent_pln: '0',
  fines_count: '0',
  insurance_expiry: '',
  przeglad_expiry: '',
  last_service_date: '',
  notes: '',
  marketplace_listed: false,
  marketplace_description: '',
  marketplace_location: 'Warszawa',
  marketplace_photo_url: '',
  deposit_amount: '0',
  fuel_type: 'benzyna',
  transmission: 'automat',
  seats: '5',
  consumption: '',
  marketplace_features: [],
  min_driver_age: '25',
  min_experience_years: '3',
  min_rental_months: '1',
  owner_phone: '',
  owner_telegram: '',
  insurance_cost: '0',
  service_cost: '0',
  other_costs: '0',
  partner_name: '',
  partner_contact: '',
  apps_available: [],
  registration_city: 'Warszawa',
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
  const [partnerSuggestOpen, setPartnerSuggestOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setPartnerSuggestOpen(false)
      return
    }
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
        insurance_expiry: (() => {
          const raw = car.insurance_expiry ? String(car.insurance_expiry) : ''
          if (raw) return raw
          const eff = effectiveInsuranceExpiryIso(car)
          return eff ? String(eff) : ''
        })(),
        przeglad_expiry: car.przeglad_expiry ? String(car.przeglad_expiry) : '',
        last_service_date: car.last_service_date ? String(car.last_service_date) : '',
        notes: String(car.notes ?? ''),
        marketplace_listed: Boolean(car.marketplace_listed ?? car.show_in_marketplace),
        marketplace_description: String(car.marketplace_description ?? ''),
        marketplace_location: String(car.marketplace_location ?? 'Warszawa'),
        marketplace_photo_url: String(car.marketplace_photo_url ?? ''),
        deposit_amount: String(car.deposit_amount ?? '0'),
        fuel_type: String(car.fuel_type ?? 'benzyna'),
        transmission: String(car.transmission ?? 'automat'),
        seats: String(car.seats ?? '5'),
        consumption: String(car.consumption ?? ''),
        marketplace_features: Array.isArray(car.marketplace_features)
          ? car.marketplace_features.map(String)
          : [],
        min_driver_age: String(car.min_driver_age ?? '25'),
        min_experience_years: String(car.min_experience_years ?? '3'),
        min_rental_months: String(car.min_rental_months ?? '1'),
        owner_phone: String(car.owner_phone ?? ''),
        owner_telegram: String(car.owner_telegram ?? ''),
        insurance_cost: (() => {
          if (car.insurance_cost != null && car.insurance_cost !== '') return String(car.insurance_cost)
          const sum = Number(car.oc_cost ?? 0) + Number(car.ac_cost ?? 0)
          return String(sum || '0')
        })(),
        service_cost: String(car.service_cost ?? '0'),
        other_costs: String(car.other_costs ?? '0'),
        partner_name: String(car.partner_name ?? ''),
        partner_contact: String(car.partner_contact ?? ''),
        apps_available: normalizeAppsAvailable(car.apps_available),
        registration_city: String(car.registration_city ?? '').trim() || 'Warszawa',
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, car])

  const partnerHintMatches = useMemo(() => {
    const q = String(form.partner_name ?? '').trim().toLowerCase()
    if (!q) return PARTNER_NAME_HINTS
    return PARTNER_NAME_HINTS.filter((h) => h.toLowerCase().includes(q))
  }, [form.partner_name])

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
    const hasDriver = Boolean(form.driver_id)
    const listed = hasDriver ? false : Boolean(form.marketplace_listed)
    const listingExtras = listed
      ? {
          marketplace_photo_url: (form.marketplace_photo_url || '').trim() || null,
          marketplace_description: (form.marketplace_description || '').trim() || null,
          marketplace_location: (form.marketplace_location || '').trim() || 'Warszawa',
          deposit_amount: Number(form.deposit_amount) || 0,
          fuel_type: form.fuel_type || 'benzyna',
          transmission: form.transmission || 'automat',
          seats: Number(form.seats) || 5,
          consumption: (form.consumption || '').trim() || null,
          marketplace_features: Array.isArray(form.marketplace_features) ? form.marketplace_features : [],
          min_driver_age: Number(form.min_driver_age) || 25,
          min_experience_years: Number(form.min_experience_years) || 3,
          min_rental_months: Number(form.min_rental_months) || 1,
          owner_phone: (form.owner_phone || '').trim() || null,
          owner_telegram: (form.owner_telegram || '').trim() || null,
        }
      : {}
    const ins = form.insurance_expiry || null
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
      insurance_expiry: ins,
      oc_expiry: ins,
      ac_expiry: ins,
      przeglad_expiry: form.przeglad_expiry || null,
      last_service_date: form.last_service_date || null,
      notes: form.notes,
      marketplace_listed: listed,
      ...listingExtras,
      show_in_marketplace: listed,
      marketplace_status: listed ? 'dostepne' : 'zajete',
      partner_name: (form.partner_name || '').trim() || null,
      partner_contact: (form.partner_contact || '').trim() || null,
      apps_available: normalizeAppsAvailable(form.apps_available),
      registration_city: (form.registration_city || '').trim() || 'Warszawa',
      ...(editing
        ? {
            insurance_cost: Number(form.insurance_cost) || 0,
            oc_cost: 0,
            ac_cost: 0,
            service_cost: Number(form.service_cost) || 0,
            other_costs: Number(form.other_costs) || 0,
          }
        : {}),
    }

    if (!payload.plate_number) {
      setError(t('carForm.plateRequired'))
      setSaving(false)
      return
    }

    try {
      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!authUser?.id) throw new Error('Brak sesji')

      if (editing) {
        let up = supabase.from('cars').update(payload).eq('id', car.id).eq('owner_id', authUser.id)
        let { error: upErr } = await up
        if (upErr && shouldUseLegacyAssignedDriverColumn(upErr)) {
          ;({ error: upErr } = await supabase
            .from('cars')
            .update(toLegacyCarWritePayload(payload))
            .eq('id', car.id)
            .eq('owner_id', authUser.id))
        }
        if (upErr) throw upErr
      } else {
        const insertPayload = { ...payload, owner_id: authUser.id }
        let { error: insErr } = await supabase.from('cars').insert(insertPayload)
        if (insErr && shouldUseLegacyAssignedDriverColumn(insErr)) {
          ;({ error: insErr } = await supabase.from('cars').insert(toLegacyCarWritePayload(insertPayload)))
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
            onChange={(e) => {
              const id = e.target.value
              setForm((f) => ({ ...f, driver_id: id, marketplace_listed: id ? false : f.marketplace_listed }))
            }}
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
        {field('insurance_expiry', t('carForm.insurance'), 'date')}
        {field('przeglad_expiry', t('carForm.prz'), 'date')}
        {field('last_service_date', t('carForm.service'), 'date')}
        {field('notes', t('carForm.notes'), 'textarea', { rows: 4 })}
        <div className="field-span-heading">
          <h3 className="stats-form-cost-heading">{t('carForm.partnerSectionHeading')}</h3>
        </div>
        <div className="field partner-autocomplete-field">
          <span className="field-label">{t('carForm.partnerCompanyLabel')}</span>
          <div className="partner-autocomplete-wrap">
            <input
              className="input"
              type="text"
              name="partner_name"
              autoComplete="off"
              value={form.partner_name}
              placeholder={t('carForm.partnerCompanyPlaceholder')}
              onChange={(e) => setForm((f) => ({ ...f, partner_name: e.target.value }))}
              onFocus={() => setPartnerSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setPartnerSuggestOpen(false), 180)}
            />
            {partnerSuggestOpen && partnerHintMatches.length > 0 ? (
              <ul className="partner-suggest-list" role="listbox">
                {partnerHintMatches.map((hint) => (
                  <li key={hint} role="presentation">
                    <button
                      type="button"
                      className="partner-suggest-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((f) => ({ ...f, partner_name: hint }))
                        setPartnerSuggestOpen(false)
                      }}
                    >
                      {hint}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {field('partner_contact', t('carForm.partnerContactLabel'), 'text', { placeholder: t('carForm.partnerContactPlaceholder') })}
        <div className="field">
          <span className="field-label">{t('carForm.appsAvailableLabel')}</span>
          <div className="market-feature-grid">
            {TAXI_APP_ORDER.map((key) => {
              const apps = Array.isArray(form.apps_available) ? form.apps_available : []
              return (
                <label key={key} className="checkbox-line market-feature-check">
                  <input
                    type="checkbox"
                    checked={apps.includes(key)}
                    onChange={() =>
                      setForm((f) => {
                        const cur = Array.isArray(f.apps_available) ? f.apps_available : []
                        const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]
                        return { ...f, apps_available: next }
                      })
                    }
                  />
                  <span>{t(`taxiApp.${key}`)}</span>
                </label>
              )
            })}
          </div>
        </div>
        {field('registration_city', t('carForm.registrationCityLabel'), 'text')}
        {form.driver_id ? <p className="muted small">{t('carForm.marketplaceDriverHint')}</p> : null}
        <label className="toggle-switch toggle-switch--block">
          <input
            type="checkbox"
            checked={Boolean(form.marketplace_listed)}
            disabled={Boolean(form.driver_id) && !form.marketplace_listed}
            onChange={(e) => setForm((f) => ({ ...f, marketplace_listed: e.target.checked }))}
          />
          <span className="toggle-switch-ui" aria-hidden />
          <span className="toggle-switch-text">{t('carForm.listedToggle')}</span>
        </label>
        {form.marketplace_listed && !form.driver_id ? (
          <MarketplaceListingFields form={form} setForm={setForm} />
        ) : null}
        {editing ? (
          <>
            <div className="field-span-heading">
              <h3 className="stats-form-cost-heading">{t('carForm.monthlyCostsHeading')}</h3>
            </div>
            {field('insurance_cost', t('carForm.insuranceCostMonth'), 'number', { min: 0, step: 1 })}
            {field('service_cost', t('carForm.serviceCostMonth'), 'number', { min: 0, step: 1 })}
            {field('other_costs', t('carForm.otherCostsMonth'), 'number', { min: 0, step: 1 })}
          </>
        ) : null}
      </form>
    </Modal>
  )
}
