import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AddCarWizard() {
  const navigate = useNavigate()
  const { refresh } = useOutletContext() ?? {}
  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [driverLabel, setDriverLabel] = useState('')
  const [rent, setRent] = useState('')
  const [oc, setOc] = useState('')
  const [ac, setAc] = useState('')
  const [prz, setPrz] = useState('')
  const [svc, setSvc] = useState('')

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const { error } = await supabase.from('cars').insert({
        plate_number: plate.trim(),
        model: model.trim(),
        year: null,
        color_label: '',
        driver_label: driverLabel.trim(),
        assigned_driver_id: null,
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
      })
      if (error) throw error
      if (typeof refresh === 'function') {
        await refresh()
      }
      setDone(true)
    } catch (e) {
      setErr(e.message ?? 'Błąd zapisu')
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
          <h1>Auto dodane!</h1>
          <p className="muted lead">Będziemy pilnować dokumentów.</p>
          <Link to="/flota" className="btn btn-huge primary">
            Moje auta
          </Link>
          <button type="button" className="btn btn-huge ghost" onClick={() => navigate('/panel')}>
            Strona główna
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-simple wizard">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← Wróć
        </Link>
      </p>
      <h1>Nowe auto</h1>
      <p className="wizard-step muted">Krok {step} z 3</p>
      {err ? <p className="form-error">{err}</p> : null}

      {step === 1 ? (
        <div className="wizard-fields">
          <label className="field">
            <span className="field-label-lg">Numer rejestracyjny</span>
            <input className="input input-xl" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="np. WX4821K" autoFocus />
          </label>
          <label className="field">
            <span className="field-label-lg">Model</span>
            <input className="input input-xl" value={model} onChange={(e) => setModel(e.target.value)} placeholder="np. Toyota Corolla" />
          </label>
          <button type="button" className="btn btn-huge primary" disabled={!plate.trim()} onClick={() => setStep(2)}>
            Dalej
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="wizard-fields">
          <label className="field">
            <span className="field-label-lg">Kierowca (imię)</span>
            <input className="input input-xl" value={driverLabel} onChange={(e) => setDriverLabel(e.target.value)} placeholder="Jan Kowalski" />
          </label>
          <label className="field">
            <span className="field-label-lg">Czynsz tygodniowy (zł)</span>
            <input className="input input-xl" type="number" min={0} step={10} value={rent} onChange={(e) => setRent(e.target.value)} placeholder="np. 800" />
          </label>
          <div className="wizard-nav-btns">
            <button type="button" className="btn btn-huge ghost" onClick={() => setStep(1)}>
              Wstecz
            </button>
            <button type="button" className="btn btn-huge primary" onClick={() => setStep(3)}>
              Dalej
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="wizard-fields">
          <p className="muted small">Daty dokumentów — możesz uzupełnić później w edycji auta.</p>
          <label className="field">
            <span className="field-label-lg">OC — ważne do</span>
            <input className="input input-xl" type="date" value={oc} onChange={(e) => setOc(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">AC — ważne do</span>
            <input className="input input-xl" type="date" value={ac} onChange={(e) => setAc(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">Przegląd techniczny</span>
            <input className="input input-xl" type="date" value={prz} onChange={(e) => setPrz(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label-lg">Ostatni serwis</span>
            <input className="input input-xl" type="date" value={svc} onChange={(e) => setSvc(e.target.value)} />
          </label>
          <div className="wizard-nav-btns">
            <button type="button" className="btn btn-huge ghost" onClick={() => setStep(2)}>
              Wstecz
            </button>
            <button type="button" className="btn btn-huge primary" disabled={saving || !plate.trim()} onClick={save}>
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
