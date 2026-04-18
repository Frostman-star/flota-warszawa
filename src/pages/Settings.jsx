import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDrivers } from '../hooks/useDrivers'
import { LoadingSpinner } from '../components/LoadingSpinner'

const DAY_OPTIONS = [30, 14, 7, 3, 1]

export function Settings() {
  const { session, user } = useAuth()
  const { drivers, refresh: refreshDrivers } = useDrivers(true)
  const [companyName, setCompanyName] = useState('Flota Warszawa')
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [alertDays, setAlertDays] = useState([30, 14, 7, 3, 1])
  const [contactEmail, setContactEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePass, setInvitePass] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data: comp } = await supabase.from('company_settings').select('company_name, contact_email').eq('id', 1).maybeSingle()
      if (comp?.company_name) setCompanyName(comp.company_name)
      if (comp?.contact_email != null) setContactEmail(comp.contact_email)

      if (user?.id) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('alert_days, email_enabled')
          .eq('user_id', user.id)
          .maybeSingle()
        if (prefs?.alert_days?.length) setAlertDays(prefs.alert_days)
        if (prefs) setEmailEnabled(Boolean(prefs.email_enabled))
      }
    } catch (e) {
      setErr(e.message ?? 'Błąd ładowania')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  function toggleDay(d) {
    setAlertDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => b - a)))
  }

  async function saveAll(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const { error: cErr } = await supabase
        .from('company_settings')
        .update({ company_name: companyName, contact_email: contactEmail.trim() || null })
        .eq('id', 1)
      if (cErr) throw cErr

      if (user?.id) {
        const { error: pErr } = await supabase.from('notification_preferences').upsert(
          {
            user_id: user.id,
            alert_days: alertDays.length ? alertDays : [30, 14, 7, 3, 1],
            email_enabled: emailEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        if (pErr) throw pErr
      }
      setMsg('Zapisano.')
    } catch (e) {
      setErr(e.message ?? 'Błąd zapisu')
    } finally {
      setSaving(false)
    }
  }

  async function inviteDriver(e) {
    e.preventDefault()
    setInviteBusy(true)
    setErr(null)
    try {
      const { data, error } = await supabase.functions.invoke('invite-driver', {
        body: { email: inviteEmail.trim().toLowerCase(), password: invitePass, full_name: inviteName.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setInviteEmail('')
      setInvitePass('')
      setInviteName('')
      setMsg('Kierowca utworzony.')
      await refreshDrivers()
    } catch (e) {
      setErr(e.message ?? 'Błąd Edge Function (invite-driver)')
    } finally {
      setInviteBusy(false)
    }
  }

  async function removeDriver(id, name) {
    if (!window.confirm(`Usunąć konto kierowcy ${name}?`)) return
    try {
      const { data, error } = await supabase.functions.invoke('remove-driver', {
        body: { user_id: id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      await refreshDrivers()
      setMsg('Usunięto.')
    } catch (e) {
      setErr(e.message ?? 'Błąd Edge Function (remove-driver)')
    }
  }

  if (loading) {
    return (
      <div className="page-pad">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="page-pad settings-page">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← Panel
        </Link>
      </p>
      <h1>Ustawienia</h1>
      <p className="muted">Firma, powiadomienia i kierowcy.</p>

      {err ? <p className="form-error">{err}</p> : null}
      {msg ? <p className="form-info">{msg}</p> : null}

      <form className="card pad-lg settings-block" onSubmit={saveAll}>
        <h2>Nazwa firmy</h2>
        <label className="field">
          <span className="field-label">Wyświetlana nazwa</span>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">E-mail kontaktowy (marketplace)</span>
          <input
            className="input"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="np. biuro@firma.pl"
          />
        </label>

        <h2 className="block-title">Powiadomienia</h2>
        <p className="muted small">Wyślij przypomnienie (push / e-mail z Edge), gdy do końca ważności zostanie dokładnie:</p>
        <div className="chip-row">
          {DAY_OPTIONS.map((d) => (
            <button key={d} type="button" className={alertDays.includes(d) ? 'chip active' : 'chip'} onClick={() => toggleDay(d)}>
              {d} dni
            </button>
          ))}
        </div>
        <label className="field checkbox-line">
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          <span>Włącz e-mail (wymaga RESEND_API_KEY w Edge + wdrożenia notify-documents)</span>
        </label>

        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}
        </button>
      </form>

      <section className="card pad-lg settings-block">
        <h2>Kierowcy</h2>
        <ul className="driver-list">
          {drivers.map((d) => (
            <li key={d.id} className="driver-row">
              <div>
                <strong>{d.full_name}</strong>
                <div className="muted small">{d.email}</div>
              </div>
              <button type="button" className="btn danger small" onClick={() => removeDriver(d.id, d.full_name)}>
                Usuń
              </button>
            </li>
          ))}
        </ul>

        <h3 className="block-title">Dodaj kierowcę</h3>
        <form className="stack-gap" onSubmit={inviteDriver}>
          <label className="field">
            <span className="field-label">E-mail</span>
            <input className="input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Hasło startowe</span>
            <input className="input" type="password" value={invitePass} onChange={(e) => setInvitePass(e.target.value)} required minLength={6} />
          </label>
          <label className="field">
            <span className="field-label">Imię i nazwisko</span>
            <input className="input" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          </label>
          <button type="submit" className="btn secondary" disabled={inviteBusy}>
            {inviteBusy ? 'Tworzenie…' : 'Utwórz konto'}
          </button>
        </form>
      </section>
    </div>
  )
}
