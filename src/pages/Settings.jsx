import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDrivers } from '../hooks/useDrivers'
import { LoadingSpinner } from '../components/LoadingSpinner'

const DAY_OPTIONS = [30, 14, 7, 3, 1]

export function Settings() {
  const { t } = useTranslation()
  const { session, user } = useAuth()
  const { drivers, refresh: refreshDrivers } = useDrivers(true, user?.id)
  const [companyName, setCompanyName] = useState('Flota Warszawa')
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [alertDays, setAlertDays] = useState([30, 14, 7, 3, 1])
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
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
      const { data: comp } = await supabase.from('company_settings').select('company_name, contact_email, contact_phone').eq('id', 1).maybeSingle()
      if (comp?.company_name) setCompanyName(comp.company_name)
      if (comp?.contact_email != null) setContactEmail(comp.contact_email)
      if (comp?.contact_phone != null) setContactPhone(comp.contact_phone)

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
      setErr(e.message ?? t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

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
        .update({
          company_name: companyName,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
        })
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
      setMsg(t('settings.saved'))
    } catch (e) {
      setErr(e.message ?? t('errors.saveFailed'))
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
      setMsg(t('settings.driverCreated'))
      await refreshDrivers()
    } catch (e) {
      setErr(e.message ?? t('settings.inviteEdgeError'))
    } finally {
      setInviteBusy(false)
    }
  }

  async function removeDriver(id, name) {
    if (!window.confirm(t('settings.confirmRemove', { name }))) return
    try {
      const { data, error } = await supabase.functions.invoke('remove-driver', {
        body: { user_id: id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      await refreshDrivers()
      setMsg(t('settings.driverRemoved'))
    } catch (e) {
      setErr(e.message ?? t('settings.removeEdgeError'))
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
          {t('settings.back')}
        </Link>
      </p>
      <h1>{t('settings.title')}</h1>
      <p className="muted">{t('settings.lead')}</p>

      {err ? <p className="form-error">{err}</p> : null}
      {msg ? <p className="form-info">{msg}</p> : null}

      <form className="card pad-lg settings-block" onSubmit={saveAll}>
        <h2>{t('settings.companyBlock')}</h2>
        <label className="field">
          <span className="field-label">{t('settings.displayName')}</span>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.contactEmail')}</span>
          <input
            className="input"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={t('settings.contactPlaceholder')}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.contactPhone')}</span>
          <input
            className="input"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder={t('settings.contactPhonePlaceholder')}
          />
        </label>

        <h2 className="block-title">{t('settings.notificationsBlock')}</h2>
        <p className="muted small">{t('settings.notificationsHint')}</p>
        <div className="chip-row">
          {DAY_OPTIONS.map((d) => (
            <button key={d} type="button" className={alertDays.includes(d) ? 'chip active' : 'chip'} onClick={() => toggleDay(d)}>
              {d} {d === 1 ? t('settings.dayOne') : t('settings.daysMany')}
            </button>
          ))}
        </div>
        <label className="field checkbox-line">
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          <span>{t('settings.emailCheckbox')}</span>
        </label>

        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? t('settings.saving') : t('settings.saveButton')}
        </button>
      </form>

      <section className="card pad-lg settings-block">
        <h2>{t('settings.driversBlock')}</h2>
        <ul className="driver-list">
          {drivers.map((d) => (
            <li key={d.id} className="driver-row">
              <div>
                <strong>{d.full_name}</strong>
                <div className="muted small">{d.email}</div>
              </div>
              <button type="button" className="btn danger small" onClick={() => removeDriver(d.id, d.full_name)}>
                {t('settings.remove')}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="block-title">{t('settings.addDriver')}</h3>
        <form className="stack-gap" onSubmit={inviteDriver}>
          <label className="field">
            <span className="field-label">{t('settings.inviteEmail')}</span>
            <input className="input" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">{t('settings.invitePassword')}</span>
            <input className="input" type="password" value={invitePass} onChange={(e) => setInvitePass(e.target.value)} required minLength={6} />
          </label>
          <label className="field">
            <span className="field-label">{t('settings.inviteFullName')}</span>
            <input className="input" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          </label>
          <button type="submit" className="btn secondary" disabled={inviteBusy}>
            {inviteBusy ? t('settings.inviteBusy') : t('settings.inviteSubmit')}
          </button>
        </form>
      </section>
    </div>
  )
}
