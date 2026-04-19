import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDrivers } from '../hooks/useDrivers'
import { shouldUseLegacyAssignedDriverColumn, toLegacyCarWritePayload } from '../utils/carDriverSchema'

export function AddCarWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useOutletContext() ?? {}
  const { isAdmin } = useAuth()
  const { drivers } = useDrivers(isAdmin)
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [driverId, setDriverId] = useState('')
  const [rent, setRent] = useState('')
  const [oc, setOc] = useState('')
  const [ac, setAc] = useState('')
  const [prz, setPrz] = useState('')
  const [svc, setSvc] = useState('')

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const row = {
        plate_number: plate.trim(),
        model: model.trim(),
        year: null,
        color_label: '',
        driver_label: '',
        driver_id: driverId || null,
        mileage_km: 0,
        weekly_rent_pln: Number(rent) || 0,
        fines_count: 0,
        oc_expiry: oc || null,
        ac_expiry: ac || null,
        przeglad_expiry: prz || null,
        last_service_date: svc || null,
        notes: '',
        show_in_marketplace: false,
        marketplace_status: 'zajete',
      }
      let { error } = await supabase.from('cars').insert(row)
      if (error && shouldUseLegacyAssignedDriverColumn(error)) {
        ;({ error } = await supabase.from('cars').insert(toLegacyCarWritePayload(row)))
      }
      if (error) throw error
      if (typeof refresh === 'function') {
        await refresh()
      }
      setDone(true)
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : ''
      if (code === '23505') {
        setErr(t('carForm.driverTakenError'))
      } else {
        setErr(e.message ?? t('errors.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="page-simple wizard-done">
        <div className="success-card">
          <p className="success-emoji" aria-hidden>
            ✅
          </p>
          <h1>{t('wizard.doneTitle')}</h1>
          <p className="muted lead">{t('wizard.doneLead')}</p>
          <Link to="/flota" className="btn btn-huge primary">
            {t('wizard.doneFleet')}
          </Link>
          <button type="button" className="btn btn-huge ghost" onClick={() => navigate('/panel')}>
            {t('wizard.doneHome')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-simple wizard">
      <p className="muted small">
        <Link to="/panel" className="link">
          {t('wizard.back')}
        </Link>
      </p>
      <h1>{t('wizard.title')}</h1>
      <p className="wizard-step muted">{t('wizard.step', { current: step })}</p>
      {err ? <p className="form-error">{err}</p> : null}

      {step === 1 ? (
        <div className="wizard-fields">
          <label className="field">
            <span className="field-label-lg">{t('wizard.plateLabel')}</span>
            <input className="input input-xl" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={t('wizard.platePh')} autoFocus />
          </label>
          <label className="field">
            <span className="field-label-lg">{t('wizard.modelLabel')}</span>
            <input className="input input-xl" value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('wizard.modelPh')} />
          </label>
          <button type="button" className="btn btn-huge primary" disabled={!plate.trim()} onClick={() => setStep(2)}>
            {t('wizard.next')}
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wizard-fields">
          <label className="field">
            <span className="field-label-lg">{t('wizard.driverLabel')}</span>
            <select className="input input-xl" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">{t('carForm.driverNone')}</option>
              {drivers.map((d) => {
                const busyElsewhere = Boolean(d.assigned_to_car_id)
                const label = `${d.full_name || '—'}${d.email ? ` · ${d.email}` : ''}${busyElsewhere ? ` ${t('carForm.driverBusySuffix')}` : ''}`
                return (
                  <option key={d.id} value={d.id} disabled={busyElsewhere}>
                    {label}
                  </option>
                )
              })}
            </select>
          </label>
          <label className="field">
            <span className="field-label-lg">{t('wizard.rentLabel')}</span>
            <input className="input input-xl" type="number" min={0} step={10} value={rent} onChange={(e) => setRent(e.target.value)} placeholder={t('wizard.rentPh')} />
          </label>
          <div className="wizard-nav-btns">
            <button type="button" className="btn btn-huge ghost" onClick={() => setStep(1)}>
              {t('wizard.backBtn')}
            </button>
            <button type="button" className="btn btn-huge primary" onClick={() => setStep(3)}>
              {t('wizard.next')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-fields">
          <p className="muted small">{t('wizard.docHint')}</p>
          <label className="field">
            <span className="field-label-lg">{t('wizard.ocLabel')}</span>
            <input className="input input-xl" type="date" value={oc} onChange={(e) => setOc(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">{t('wizard.acLabel')}</span>
            <input className="input input-xl" type="date" value={ac} onChange={(e) => setAc(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">{t('wizard.przLabel')}</span>
            <input className="input input-xl" type="date" value={prz} onChange={(e) => setPrz(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">{t('wizard.svcLabel')}</span>
            <input className="input input-xl" type="date" value={svc} onChange={(e) => setSvc(e.target.value)} />
          </label>
          <div className="wizard-nav-btns">
            <button type="button" className="btn btn-huge ghost" onClick={() => setStep(2)}>
              {t('wizard.backBtn')}
            </button>
            <button type="button" className="btn btn-huge primary" disabled={saving || !plate.trim()} onClick={save}>
              {saving ? t('wizard.saving') : t('wizard.save')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
