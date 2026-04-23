import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDrivers } from '../hooks/useDrivers'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PwaInstallInstructionsModal } from '../components/PwaInstallInstructionsModal'

const DAY_OPTIONS = [30, 14, 7, 3, 1]

export function Settings() {
  const { t } = useTranslation()
  const { session, user } = useAuth()
  const { drivers, refresh: refreshDrivers } = useDrivers(true, user?.id)
  const [companyName, setCompanyName] = useState('Cario')
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [alertDays, setAlertDays] = useState([30, 14, 7, 3, 1])
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactTelegram, setContactTelegram] = useState('')
  const [companyDescription, setCompanyDescription] = useState('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState('')
  const [companyLocation, setCompanyLocation] = useState('Warszawa')
  const [companyPhone, setCompanyPhone] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePass, setInvitePass] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [pwaInstallOpen, setPwaInstallOpen] = useState(false)
  const [referralProgram, setReferralProgram] = useState(null)
  const [planBusy, setPlanBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const { data: comp } = await supabase
        .from('company_settings')
        .select('company_name, contact_email, contact_phone, contact_telegram')
        .eq('id', 1)
        .maybeSingle()
      if (comp?.company_name) setCompanyName(comp.company_name)
      if (comp?.contact_email != null) setContactEmail(comp.contact_email)
      if (comp?.contact_phone != null) setContactPhone(comp.contact_phone)
      if (comp?.contact_telegram != null) setContactTelegram(comp.contact_telegram)

      if (user?.id) {
        const { data: ownProfile } = await supabase
          .from('profiles')
          .select('company_name, company_logo_url, company_description, company_phone, company_location')
          .eq('id', user.id)
          .maybeSingle()
        if (ownProfile) {
          if (ownProfile.company_name) setCompanyName(ownProfile.company_name)
          setCompanyLogoUrl(String(ownProfile.company_logo_url ?? ''))
          setCompanyDescription(String(ownProfile.company_description ?? ''))
          setCompanyPhone(String(ownProfile.company_phone ?? ''))
          setCompanyLocation(String(ownProfile.company_location ?? 'Warszawa'))
        }
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('alert_days, email_enabled')
          .eq('user_id', user.id)
          .maybeSingle()
        if (prefs?.alert_days?.length) setAlertDays(prefs.alert_days)
        if (prefs) setEmailEnabled(Boolean(prefs.email_enabled))
        const { data: referralData, error: referralErr } = await supabase.rpc('get_my_owner_referral_program')
        if (referralErr) throw referralErr
        if (Array.isArray(referralData) && referralData[0]) {
          setReferralProgram(referralData[0])
        } else {
          setReferralProgram(null)
        }
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
          contact_telegram: contactTelegram.trim() || null,
        })
        .eq('id', 1)
      if (cErr) throw cErr

      if (user?.id) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            company_name: companyName.trim() || null,
            company_description: companyDescription.trim() || null,
            company_logo_url: companyLogoUrl.trim() || null,
            company_phone: companyPhone.trim() || null,
            company_location: companyLocation.trim() || 'Warszawa',
          })
          .eq('id', user.id)
        if (profileErr) throw profileErr
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

  async function uploadCompanyLogo(file) {
    if (!user?.id || !file) return
    setUploadBusy(true)
    setErr(null)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/company-logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('company-logos').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('company-logos').getPublicUrl(path)
      setCompanyLogoUrl(String(data?.publicUrl ?? ''))
    } catch (e) {
      setErr(e.message ?? t('errors.saveFailed'))
    } finally {
      setUploadBusy(false)
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

  async function changePlan(nextTier) {
    setPlanBusy(true)
    setErr(null)
    try {
      const { data, error } = await supabase.rpc('set_my_owner_plan', { p_tier: nextTier })
      if (error) throw error
      if (data !== 'ok') throw new Error(t('settings.planChangeFailed'))
      const { data: referralData, error: referralErr } = await supabase.rpc('get_my_owner_referral_program')
      if (referralErr) throw referralErr
      if (Array.isArray(referralData) && referralData[0]) setReferralProgram(referralData[0])
      setMsg(t('settings.saved'))
    } catch (e) {
      setErr(e.message ?? t('settings.planChangeFailed'))
    } finally {
      setPlanBusy(false)
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
      <p className="settings-pwa-install-wrap">
        <button type="button" className="link settings-pwa-install-link" onClick={() => setPwaInstallOpen(true)}>
          {t('pwaInstall.settings.link')}
        </button>
      </p>

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
        <label className="field">
          <span className="field-label">{t('settings.contactTelegram')}</span>
          <input
            className="input"
            value={contactTelegram}
            onChange={(e) => setContactTelegram(e.target.value)}
            placeholder={t('settings.contactTelegramPlaceholder')}
          />
        </label>
        <h2 className="block-title" id="profil-firmy">{t('settings.companyProfileTitle')}</h2>
        <label className="field">
          <span className="field-label">{t('settings.companyLocation')}</span>
          <input className="input" value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.companyPhone')}</span>
          <input className="input" type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.companyDescription')}</span>
          <textarea
            className="input input-textarea"
            rows={4}
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            placeholder={t('settings.companyDescriptionPlaceholder')}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('settings.companyLogo')}</span>
          {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="driver-avatar-lg" /> : null}
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadCompanyLogo(f)
            }}
          />
          <span className="muted small">{uploadBusy ? t('app.loading') : t('settings.companyLogoHint')}</span>
        </label>
        {user?.id ? (
          <Link to={`/flota/${user.id}`} className="link">
            {t('settings.publicProfilePreview')}
          </Link>
        ) : null}

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
        <h2>{t('settings.referralTitle')}</h2>
        <p className="muted">{t('settings.referralLead')}</p>
        <label className="field">
          <span className="field-label">{t('settings.currentPlan')}</span>
          <div className="chip-row">
            <button
              type="button"
              className={referralProgram?.plan_tier === 'free' ? 'chip active' : 'chip'}
              onClick={() => changePlan('free')}
              disabled={planBusy}
            >
              FREE
            </button>
            <button
              type="button"
              className={referralProgram?.plan_tier === 'start' ? 'chip active' : 'chip'}
              onClick={() => changePlan('start')}
              disabled={planBusy}
            >
              START
            </button>
            <button
              type="button"
              className={referralProgram?.plan_tier === 'pro' ? 'chip active' : 'chip'}
              onClick={() => changePlan('pro')}
              disabled={planBusy}
            >
              PRO
            </button>
          </div>
        </label>
        <p className="muted small">
          {t('settings.planExpires')}: {referralProgram?.plan_expires_at || t('settings.planNoExpiry')}
        </p>
        <label className="field">
          <span className="field-label">{t('settings.referralLink')}</span>
          <div className="btn-row">
            <input
              className="input"
              value={
                referralProgram?.referral_code
                  ? `${window.location.origin}/register?mode=register&role=owner&ref=${referralProgram.referral_code}`
                  : ''
              }
              readOnly
            />
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                const link = referralProgram?.referral_code
                  ? `${window.location.origin}/register?mode=register&role=owner&ref=${referralProgram.referral_code}`
                  : ''
                if (!link) return
                navigator.clipboard.writeText(link)
                setMsg(t('settings.referralCopied'))
              }}
            >
              {t('panel.copyLink')}
            </button>
          </div>
        </label>
        <div className="chip-row">
          <span className="chip active">{t('settings.referralRegistered', { count: referralProgram?.registered_count ?? 0 })}</span>
          <span className="chip active">{t('settings.referralPendingPaid', { count: referralProgram?.pending_count ?? 0 })}</span>
          <span className="chip active">{t('settings.referralQualified', { count: referralProgram?.qualified_count ?? 0 })}</span>
          <span className="chip active">{t('settings.referralRewarded', { count: referralProgram?.rewarded_count ?? 0 })}</span>
          <span className="chip active">{t('settings.referralRejected', { count: referralProgram?.rejected_count ?? 0 })}</span>
          <span className="chip active">{t('settings.referralBonusMonths', { count: referralProgram?.bonus_months ?? 0 })}</span>
        </div>
      </section>

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

      <PwaInstallInstructionsModal open={pwaInstallOpen} onClose={() => setPwaInstallOpen(false)} />
    </div>
  )
}
