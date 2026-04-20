import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DriverProfileCard } from '../components/DriverProfileCard'
import { DriverEmploymentActions } from '../components/DriverEmploymentActions'
import { useDriverAssignedCar } from '../hooks/useDriverAssignedCar'
import {
  driverAgeYears,
  driverProfileProgressPercent,
  isDriverProfileCompleteForApply,
  POLAND_STATUS_KEYS,
} from '../utils/driverProfile'

export function DriverProfile() {
  const { t } = useTranslation()
  const { user, refreshProfile, profile } = useAuth()
  const { assignment, loading: assignmentLoading, refresh: refreshAssignedCar } = useDriverAssignedCar(
    user?.id,
    Boolean(user?.id)
  )
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [experienceYears, setExperienceYears] = useState('0')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [polandStatus, setPolandStatus] = useState('')
  const [polandDocRef, setPolandDocRef] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [docThumbUrl, setDocThumbUrl] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  const avatarInputRef = useRef(null)
  const docInputRef = useRef(null)

  useEffect(() => {
    setFullName(String(profile?.full_name ?? ''))
    setPhone(String(profile?.phone ?? ''))
    setExperienceYears(profile?.experience_years != null ? String(profile.experience_years) : '0')
    setBio(String(profile?.bio ?? ''))
    setGender(String(profile?.gender ?? ''))
    setBirthYear(profile?.birth_year != null ? String(profile.birth_year) : '')
    setPolandStatus(String(profile?.poland_status ?? ''))
    setPolandDocRef(String(profile?.poland_status_doc_url ?? ''))
    setAvatarUrl(String(profile?.avatar_url ?? ''))
  }, [profile])

  useEffect(() => {
    let cancelled = false
    const ref = polandDocRef.trim()
    if (!ref) {
      setDocThumbUrl(null)
      return
    }
    if (ref.startsWith('http')) {
      setDocThumbUrl(ref)
      return
    }
    ;(async () => {
      const { data, error } = await supabase.storage.from('profile-docs').createSignedUrl(ref, 3600)
      if (!cancelled) setDocThumbUrl(!error && data?.signedUrl ? data.signedUrl : null)
    })()
    return () => {
      cancelled = true
    }
  }, [polandDocRef])

  const draftProfile = useMemo(
    () => ({
      full_name: fullName,
      phone,
      experience_years: Number(experienceYears),
      bio,
      gender,
      birth_year: birthYear ? Number(birthYear) : null,
      poland_status: polandStatus,
      poland_status_doc_url: polandDocRef,
      avatar_url: avatarUrl,
    }),
    [fullName, phone, experienceYears, bio, gender, birthYear, polandStatus, polandDocRef, avatarUrl]
  )

  const progress = driverProfileProgressPercent(draftProfile)
  const applyReady = isDriverProfileCompleteForApply(draftProfile)
  const agePreview = driverAgeYears(birthYear ? Number(birthYear) : null)

  const modelLine = assignment
    ? [assignment.model, assignment.year].filter((x) => x != null && String(x).trim() !== '').join(' ')
    : ''
  const partnerLine = assignment?.partnerNames?.length
    ? assignment.partnerNames.map((x) => String(x).trim()).filter(Boolean).join(', ')
    : '—'
  const rentNum = assignment?.weeklyRentPln != null ? Number(assignment.weeklyRentPln) : NaN
  const rentLine = Number.isFinite(rentNum) ? t('driverEmployment.weeklyRent', { amount: rentNum }) : '—'

  const uploadAvatar = useCallback(
    async (file) => {
      if (!user?.id || !file) return
      setUploadBusy(true)
      setMsg(null)
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${user.id}/avatar-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' })
        if (error) throw error
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        setAvatarUrl(data.publicUrl)
      } catch (e) {
        setMsg(e?.message ?? String(e))
      } finally {
        setUploadBusy(false)
      }
    },
    [user?.id]
  )

  const uploadDoc = useCallback(
    async (file) => {
      if (!user?.id || !file) return
      setUploadBusy(true)
      setMsg(null)
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${user.id}/doc-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('profile-docs').upload(path, file, { upsert: true })
        if (error) throw error
        setPolandDocRef(path)
      } catch (e) {
        setMsg(e?.message ?? String(e))
      } finally {
        setUploadBusy(false)
      }
    },
    [user?.id]
  )

  const save = useCallback(async () => {
    if (!user?.id) return
    setSaving(true)
    setMsg(null)
    const years = Number.parseInt(String(experienceYears), 10)
    const by = birthYear ? Number.parseInt(String(birthYear), 10) : null
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        experience_years: Number.isFinite(years) ? years : 0,
        bio: bio.trim() || null,
        gender: gender || null,
        birth_year: by != null && Number.isFinite(by) ? by : null,
        poland_status: polandStatus || null,
        poland_status_doc_url: polandDocRef.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setMsg(error.message)
      return
    }
    await refreshProfile()
    setMsg('ok')
  }, [
    user?.id,
    fullName,
    phone,
    experienceYears,
    bio,
    gender,
    birthYear,
    polandStatus,
    polandDocRef,
    avatarUrl,
    refreshProfile,
  ])

  return (
    <div className="page-simple driver-profile-page">
      <p className="muted small">
        <Link to="/marketplace" className="link">
          ← {t('nav.marketplace')}
        </Link>
      </p>
      <h1>{t('driverProfile.title')}</h1>
      <p className="muted">{t('driverProfile.lead')}</p>

      {assignmentLoading ? (
        <div className="driver-employment-card driver-employment-card--loading card pad-lg muted small" aria-busy="true">
          {t('app.loading')}
        </div>
      ) : assignment ? (
        <section className="driver-employment-card driver-employment-card--active card pad-lg" aria-label={t('driverEmployment.currentlyWorking')}>
          <p className="driver-employment-kicker">✅ {t('driverEmployment.currentlyWorking')}</p>
          <p className="driver-employment-line">
            🚗 {assignment.plate}
            {modelLine ? ` — ${modelLine}` : ''}
          </p>
          <p className="driver-employment-line">
            🏢 {t('driverEmployment.partner')}: {partnerLine}
          </p>
          <p className="driver-employment-line">💰 {rentLine}</p>
          <p className="driver-employment-line">
            📍 {t('driverEmployment.registration')}: {assignment.registrationCity || '—'}
          </p>
          <p className="driver-employment-line">
            {t('driverEmployment.owner')}: {assignment.ownerName}
          </p>
          <DriverEmploymentActions
            carId={assignment.carId}
            userId={user?.id}
            onUpdated={() => void refreshAssignedCar()}
          />
        </section>
      ) : (
        <section className="driver-employment-card driver-employment-card--idle card pad-lg" aria-label={t('driverEmployment.noCarAssigned')}>
          <p className="driver-employment-kicker">⏳ {t('driverEmployment.noCarAssigned')}</p>
          <p className="muted small driver-employment-idle-hint">{t('driverEmployment.browseHint')}</p>
          <Link to="/marketplace" className="link-strong driver-employment-cta">
            {t('driverEmployment.goMarketplace')}
          </Link>
        </section>
      )}

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
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void uploadAvatar(f)
          }}
        />
        <button
          type="button"
          className="driver-avatar-hit"
          disabled={uploadBusy}
          onClick={() => avatarInputRef.current?.click()}
          aria-label={t('driverProfile.avatarUploadAria')}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="driver-avatar-lg" />
          ) : (
            <div className="driver-avatar-lg driver-avatar-lg--ph">{t('driverProfile.avatarPlaceholder')}</div>
          )}
        </button>
        <p className="muted small driver-avatar-hint">{t('driverProfile.avatarHint')}</p>

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

        <span className="field-label-lg">{t('driverProfile.genderLabel')} *</span>
        <div className="driver-gender-row" role="group" aria-label={t('driverProfile.genderLabel')}>
          {(['male', 'female']).map((g) => (
            <button
              key={g}
              type="button"
              className={`btn btn-huge${gender === g ? ' primary' : ' ghost'}`}
              onClick={() => setGender(g)}
            >
              {t(`driverProfile.gender.${g}`)}
            </button>
          ))}
        </div>

        <label className="field-label-lg" htmlFor="dp-by">
          {t('driverProfile.birthYear')} *
        </label>
        <input
          id="dp-by"
          className="input input-xl"
          type="number"
          min={1940}
          max={new Date().getFullYear()}
          step={1}
          placeholder="1990"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
        />
        {agePreview != null ? <p className="muted small">{t('driverProfile.ageDisplay', { age: agePreview })}</p> : null}

        <span className="field-label-lg">{t('driverProfile.polandStatusLabel')} *</span>
        <div className="driver-poland-stack" role="radiogroup" aria-label={t('driverProfile.polandStatusLabel')}>
          {POLAND_STATUS_KEYS.map((key) => (
            <label key={key} className="driver-radio-line">
              <input type="radio" name="poland_status" value={key} checked={polandStatus === key} onChange={() => setPolandStatus(key)} />
              <span>{t(`driverProfile.polandStatus.${key}`)}</span>
            </label>
          ))}
        </div>

        {polandStatus ? (
          <div className="driver-doc-upload-block">
            <input
              ref={docInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void uploadDoc(f)
              }}
            />
            <button type="button" className="btn btn-huge secondary" disabled={uploadBusy} onClick={() => docInputRef.current?.click()}>
              {t('driverProfile.docPhotoButton')}
            </button>
            {docThumbUrl ? (
              <img src={docThumbUrl} alt="" className="driver-doc-thumb" />
            ) : null}
            <p className="muted tiny">{t('driverProfile.docPhotoVisibility')}</p>
          </div>
        ) : null}

        <label className="field-label-lg" htmlFor="dp-bio">
          {t('driverProfile.bio')}
        </label>
        <textarea id="dp-bio" className="input input-textarea" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />

        <button type="button" className="btn btn-huge primary" disabled={saving || uploadBusy} onClick={() => void save()}>
          {saving ? t('app.loading') : t('app.save')}
        </button>
      </div>

      <section className="card pad-lg driver-preview-section">
        <h2 className="driver-preview-title">{t('driverProfile.previewTitle')}</h2>
        <p className="muted small">{t('driverProfile.previewHint')}</p>
        <DriverProfileCard profile={draftProfile} />
      </section>
    </div>
  )
}
