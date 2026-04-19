import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { driverProfileProgressPercent, isDriverProfileCompleteForApply } from '../utils/driverProfile'

export function DriverProfile() {
  const { t } = useTranslation()
  const { user, refreshProfile, profile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [experienceYears, setExperienceYears] = useState('0')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setFullName(String(profile?.full_name ?? ''))
    setPhone(String(profile?.phone ?? ''))
    setExperienceYears(profile?.experience_years != null ? String(profile.experience_years) : '0')
    setBio(String(profile?.bio ?? ''))
  }, [profile])

  const draftProfile = useMemo(
    () => ({
      full_name: fullName,
      phone,
      experience_years: Number(experienceYears),
      bio,
    }),
    [fullName, phone, experienceYears, bio]
  )

  const progress = driverProfileProgressPercent(draftProfile)
  const applyReady = isDriverProfileCompleteForApply(draftProfile)

  const save = useCallback(async () => {
    if (!user?.id) return
    setSaving(true)
    setMsg(null)
    const years = Number.parseInt(String(experienceYears), 10)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        experience_years: Number.isFinite(years) ? years : 0,
        bio: bio.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setMsg(error.message)
      return
    }
    await refreshProfile()
    setMsg('ok')
  }, [user?.id, fullName, phone, experienceYears, bio, refreshProfile])

  return (
    <div className="page-simple driver-profile-page">
      <p className="muted small">
        <Link to="/marketplace" className="link">
          ← {t('nav.marketplace')}
        </Link>
      </p>
      <h1>{t('driverProfile.title')}</h1>
      <p className="muted">{t('driverProfile.lead')}</p>

      {!applyReady ? (
        <div className="profile-banner warn" role="status">
          {t('driverProfile.incompleteBanner')}
        </div>
      ) : null}

      <div className="profile-progress card pad-lg">
        <div className="profile-progress-label">{t('driverProfile.progress', { pct: progress })}</div>
        <div className="profile-progress-bar" aria-hidden>
          <div className="profile-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {msg === 'ok' ? <p className="form-success">{t('driverProfile.saved')}</p> : null}
      {msg && msg !== 'ok' ? <p className="form-error">{msg}</p> : null}

      <div className="card pad-lg stack-form">
        <label className="field-label-lg" htmlFor="dp-name">
          {t('driverProfile.fullName')} *
        </label>
        <input
          id="dp-name"
          className="input input-xl"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />

        <label className="field-label-lg" htmlFor="dp-phone">
          {t('driverProfile.phone')} *
        </label>
        <input
          id="dp-phone"
          className="input input-xl"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
        />

        <label className="field-label-lg" htmlFor="dp-exp">
          {t('driverProfile.experienceYears')} *
        </label>
        <input
          id="dp-exp"
          className="input input-xl"
          type="number"
          min={0}
          max={60}
          value={experienceYears}
          onChange={(e) => setExperienceYears(e.target.value)}
        />

        <label className="field-label-lg" htmlFor="dp-bio">
          {t('driverProfile.bio')}
        </label>
        <textarea id="dp-bio" className="input input-textarea" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />

        <button type="button" className="btn btn-huge primary" disabled={saving} onClick={() => void save()}>
          {saving ? t('app.loading') : t('app.save')}
        </button>
      </div>
    </div>
  )
}
