import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { carPath } from '../lib/carPaths'
import { useAuth } from '../context/AuthContext'
import { useCar } from '../hooks/useCars'
import { useCarHistory } from '../hooks/useCarHistory'
import { useDriverCar } from '../hooks/useDriverCar'
import { CarFormModal } from '../components/CarFormModal'
import { MarketplaceListingFields } from '../components/MarketplaceListingFields'
import { CarStatusBadge } from '../components/CarStatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { NoteModal } from '../components/NoteModal'
import { HandoverSection } from '../components/HandoverSection'
import { CarDetailMobileBottomSheet } from '../components/CarDetailMobileBottomSheet'
import { useDrivers } from '../hooks/useDrivers'
import { useVehiclePhotos } from '../hooks/useVehiclePhotos'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { expiryStatusLabel, serviceStatusLabel } from '../utils/docLabels'
import { localeTag } from '../utils/localeTag'
import { TAXI_APP_ORDER, formatPartnerNamesFromCar, normalizeAppsAvailable, normalizePartnerNames } from '../utils/partnerApps'
import { shouldUseLegacyAssignedDriverColumn, toLegacyCarWritePayload } from '../utils/carDriverSchema'
import { MarketplaceVehiclePhotos } from '../components/MarketplaceVehiclePhotos'
import { MarketplaceCarPhotoGallery } from '../components/MarketplaceCarPhotoGallery'
import { AppPlatformPills } from '../components/AppPlatformPills'
import { fuelIcon, transmissionIcon, normalizeMarketplaceFeatures } from '../utils/marketplaceDisplay'
import { VEHICLE_PHOTO_REQUIRED } from '../utils/vehiclePhotoAngles'

const KNOWN_PARTNER_CHIPS = ['Promin', 'Qiwi', 'Spark', 'Fleet Partner']

function normalizePartnerNamesPayload(list) {
  const out = []
  const seen = new Set()
  for (const x of Array.isArray(list) ? list : []) {
    const value = String(x).trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function daysUntilDate(isoDate) {
  if (!isoDate) return null
  const d = new Date(String(isoDate))
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.ceil((target - today) / 86400000)
}

export function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isAdmin, user, profile } = useAuth()
  const { drivers } = useDrivers(isAdmin, user?.id)
  const { carId: assignedCarId } = useDriverCar(!isAdmin ? user?.id : null)

  const { car, loading, error, refresh } = useCar(id ?? null, {
    userId: isAdmin ? null : user?.id,
    ownerId: isAdmin ? user?.id ?? null : null,
  })

  const isOwner = Boolean(isAdmin && user?.id && car && String(car.owner_id) === String(user.id))

  const { entries, loading: histLoading, refresh: refreshHist } = useCarHistory(car?.id ?? null, { enabled: isOwner })

  const photosSectionRef = useRef(null)

  const [mileageVal, setMileageVal] = useState('')
  const [mileBusy, setMileBusy] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const [listingForm, setListingForm] = useState(null)
  const [listingBusy, setListingBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [pendingApps, setPendingApps] = useState([])
  const [pendingAppsLoading, setPendingAppsLoading] = useState(false)
  const [activeSheet, setActiveSheet] = useState(null)
  const [mobileSaving, setMobileSaving] = useState(false)
  const [mobileForm, setMobileForm] = useState(null)
  const { photos: vehiclePhotos } = useVehiclePhotos(car?.id)

  useEffect(() => {
    if (!car) {
      setListingForm(null)
      setMobileForm(null)
      return
    }
    setListingForm({
      marketplace_description: String(car.marketplace_description ?? ''),
      marketplace_location: String(car.marketplace_location ?? 'Warszawa'),
      marketplace_photo_url: String(car.marketplace_photo_url ?? ''),
      deposit_amount: String(car.deposit_amount ?? '0'),
      fuel_type: String(car.fuel_type ?? 'benzyna'),
      transmission: String(car.transmission ?? 'automat'),
      seats: String(car.seats ?? '5'),
      consumption: String(car.consumption ?? ''),
      marketplace_features: Array.isArray(car.marketplace_features) ? car.marketplace_features.map(String) : [],
      min_driver_age: String(car.min_driver_age ?? '25'),
      min_experience_years: String(car.min_experience_years ?? '3'),
      min_rental_months: String(car.min_rental_months ?? '1'),
      owner_phone: String(car.owner_phone ?? ''),
      owner_telegram: String(car.owner_telegram ?? ''),
    })
    setMobileForm({
      insurance_expiry: (() => {
        const raw = car.insurance_expiry ? String(car.insurance_expiry) : ''
        if (raw) return raw
        const eff = effectiveInsuranceExpiryIso(car)
        return eff ? String(eff) : ''
      })(),
      insurance_cost: String(car.insurance_cost ?? (Number(car.oc_cost ?? 0) + Number(car.ac_cost ?? 0) || '0')),
      przeglad_expiry: car.przeglad_expiry ? String(car.przeglad_expiry) : '',
      last_service_date: car.last_service_date ? String(car.last_service_date) : '',
      service_cost: String(car.service_cost ?? '0'),
      service_note: '',
      driver_id: car.driver_id ? String(car.driver_id) : '',
      weekly_rent_pln: String(car.weekly_rent_pln ?? '0'),
      partner_names: normalizePartnerNames(car.partner_names, car.partner_name),
      apps_available: normalizeAppsAvailable(car.apps_available),
      registration_city: String(car.registration_city ?? '').trim() || 'Warszawa',
      mileage_km: String(car.mileage_km ?? '0'),
      year: car.year != null ? String(car.year) : '',
      color_label: String(car.color_label ?? ''),
      fines_count: String(car.fines_count ?? '0'),
      notes: String(car.notes ?? ''),
      marketplace_listed: Boolean(car.marketplace_listed ?? car.show_in_marketplace),
    })
  }, [car?.id, car?.updated_at])

  useEffect(() => {
    if (!isOwner || !car?.id || !user?.id) {
      setPendingApps([])
      setPendingAppsLoading(false)
      return
    }
    let cancelled = false
    setPendingAppsLoading(true)
    void supabase
      .from('driver_applications')
      .select('id, driver_name, driver_phone, driver_message, created_at')
      .eq('car_id', car.id)
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        setPendingAppsLoading(false)
        if (error) {
          console.error(error)
          setPendingApps([])
          return
        }
        setPendingApps(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [isOwner, car?.id, user?.id])

  const docRows = useMemo(() => {
    if (!car) return []
    const ins = effectiveInsuranceExpiryIso(car)
    return [
      { key: 'insurance', label: t('docs.insurance_expiry'), date: ins, service: false },
      { key: 'przeglad_expiry', label: t('docs.przeglad_expiry'), date: car.przeglad_expiry, service: false },
      { key: 'last_service_date', label: t('docs.last_service_date'), date: car.last_service_date, service: true },
    ]
  }, [car, t])

  if (!isAdmin && assignedCarId && id && id !== assignedCarId) {
    return <Navigate to={carPath(assignedCarId, false)} replace />
  }

  if (loading) {
    return (
      <div className="page-simple">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="page-simple">
        <p className="form-error">{error ?? t('errors.carNotFound')}</p>
        <button type="button" className="btn btn-huge ghost" onClick={() => navigate(isAdmin ? '/flota' : '/')}>
          {t('app.back')}
        </button>
      </div>
    )
  }

  async function saveMileage() {
    if (!isOwner) return
    const next = Number(mileageVal)
    if (!Number.isFinite(next) || next < 0) {
      setFormErr(t('carDetail.mileageInvalid'))
      return
    }
    setMileBusy(true)
    setFormErr(null)
    const prev = Number(car.mileage_km ?? 0)
    try {
      let uq = supabase.from('cars').update({ mileage_km: next }).eq('id', car.id)
      if (isAdmin && user?.id) uq = uq.eq('owner_id', user.id)
      const { error: u } = await uq
      if (u) throw u
      const { error: h } = await supabase.from('car_history').insert({
        car_id: car.id,
        event_type: 'mileage',
        previous_mileage: prev,
        new_mileage: next,
        detail: t('carDetail.mileageHistoryDetail', { prev, next }),
        created_by: user?.id ?? null,
      })
      if (h) throw h
      setMileageVal('')
      await refresh()
      await refreshHist()
    } catch (e) {
      setFormErr(e.message ?? t('errors.generic'))
    } finally {
      setMileBusy(false)
    }
  }

  async function saveNote(text) {
    if (!isOwner) return
    const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
    const stamp = new Date().toLocaleString(lc)
    const next = `${car.notes ? `${car.notes.trim()}\n\n` : ''}[${stamp}] ${text.trim()}`
    let nq = supabase.from('cars').update({ notes: next }).eq('id', car.id)
    if (isAdmin && user?.id) nq = nq.eq('owner_id', user.id)
    const { error: u } = await nq
    if (u) throw u
    await refresh()
  }

  async function saveMarketplace(patch) {
    const merged = { ...patch }
    if ('marketplace_listed' in merged) {
      const on = Boolean(merged.marketplace_listed)
      merged.show_in_marketplace = on
      merged.marketplace_status = on ? 'dostepne' : 'zajete'
    }
    let mq = supabase.from('cars').update(merged).eq('id', car.id)
    if (isAdmin && user?.id) mq = mq.eq('owner_id', user.id)
    const { error: u } = await mq
    if (u) throw u
    await refresh()
  }

  async function saveCarPatch(patch) {
    if (!isOwner || !user?.id) return
    setMobileSaving(true)
    setFormErr(null)
    try {
      let up = supabase.from('cars').update(patch).eq('id', car.id).eq('owner_id', user.id)
      let { error: upErr } = await up
      if (upErr && shouldUseLegacyAssignedDriverColumn(upErr)) {
        ;({ error: upErr } = await supabase
          .from('cars')
          .update(toLegacyCarWritePayload(patch))
          .eq('id', car.id)
          .eq('owner_id', user.id))
      }
      if (upErr) throw upErr
      await refresh()
      setActiveSheet(null)
    } catch (e) {
      setFormErr(e.message ?? t('errors.generic'))
    } finally {
      setMobileSaving(false)
    }
  }

  async function saveMobileSheet(sheet) {
    if (!mobileForm) return
    if (sheet === 'insurance') {
      const value = mobileForm.insurance_expiry || null
      return saveCarPatch({
        insurance_expiry: value,
        oc_expiry: value,
        ac_expiry: value,
        insurance_cost: Number(mobileForm.insurance_cost) || 0,
      })
    }
    if (sheet === 'inspection') return saveCarPatch({ przeglad_expiry: mobileForm.przeglad_expiry || null })
    if (sheet === 'service') {
      const note = String(mobileForm.service_note || '').trim()
      const nextNotes = note ? `${String(car.notes || '').trim() ? `${String(car.notes).trim()}\n\n` : ''}${note}` : car.notes
      return saveCarPatch({
        last_service_date: mobileForm.last_service_date || null,
        service_cost: Number(mobileForm.service_cost) || 0,
        notes: nextNotes ?? '',
      })
    }
    if (sheet === 'driver') {
      return saveCarPatch({
        driver_id: mobileForm.driver_id || null,
        driver_label: '',
        marketplace_listed: mobileForm.driver_id ? false : Boolean(car.marketplace_listed),
        show_in_marketplace: mobileForm.driver_id ? false : Boolean(car.show_in_marketplace),
        marketplace_status: mobileForm.driver_id ? 'zajete' : car.marketplace_status,
      })
    }
    if (sheet === 'rent') {
      return saveCarPatch({
        weekly_rent_pln: Number(mobileForm.weekly_rent_pln) || 0,
        partner_names: normalizePartnerNamesPayload(mobileForm.partner_names),
        partner_name: null,
        apps_available: normalizeAppsAvailable(mobileForm.apps_available),
        registration_city: String(mobileForm.registration_city || '').trim() || 'Warszawa',
      })
    }
    if (sheet === 'rest') {
      return saveCarPatch({
        mileage_km: Number(mobileForm.mileage_km) || 0,
        year: mobileForm.year ? Number(mobileForm.year) : null,
        color_label: String(mobileForm.color_label || '').trim(),
        fines_count: Number(mobileForm.fines_count) || 0,
        notes: String(mobileForm.notes || ''),
        marketplace_listed: Boolean(mobileForm.marketplace_listed),
        show_in_marketplace: Boolean(mobileForm.marketplace_listed),
        marketplace_status: mobileForm.marketplace_listed ? 'dostepne' : 'zajete',
      })
    }
  }

  async function saveListingBlock() {
    if (!listingForm) return
    setListingBusy(true)
    setFormErr(null)
    try {
      await saveMarketplace({
        marketplace_description: listingForm.marketplace_description.trim() || null,
        marketplace_location: listingForm.marketplace_location.trim() || 'Warszawa',
        marketplace_photo_url: listingForm.marketplace_photo_url.trim() || null,
        deposit_amount: Number(listingForm.deposit_amount) || 0,
        fuel_type: listingForm.fuel_type || 'benzyna',
        transmission: listingForm.transmission || 'automat',
        seats: Number(listingForm.seats) || 5,
        consumption: listingForm.consumption.trim() || null,
        marketplace_features: Array.isArray(listingForm.marketplace_features) ? listingForm.marketplace_features : [],
        min_driver_age: Number(listingForm.min_driver_age) || 25,
        min_experience_years: Number(listingForm.min_experience_years) || 3,
        min_rental_months: Number(listingForm.min_rental_months) || 1,
        owner_phone: listingForm.owner_phone.trim() || null,
        owner_telegram: listingForm.owner_telegram.trim() || null,
      })
    } catch (err) {
      setFormErr(err.message ?? t('errors.generic'))
    } finally {
      setListingBusy(false)
    }
  }

  async function handleDeleteCar() {
    if (!user?.id) return
    if (!window.confirm(t('fleet.confirmDelete', { plate: car.plate_number }))) return
    setDeleteBusy(true)
    setFormErr(null)
    try {
      const { error: delErr } = await supabase.from('cars').delete().eq('id', car.id).eq('owner_id', user.id)
      if (delErr) throw delErr
      navigate('/flota')
    } catch (e) {
      setFormErr(e.message ?? t('errors.generic'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const hasDriver = Boolean(car.driver_id)
  const listed = Boolean(car.marketplace_listed)
  const canTurnListingOn = !hasDriver

  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const partnersLine = formatPartnerNamesFromCar(car)
  const partnerContact = String(car.partner_contact ?? '').trim()
  const feats = normalizeMarketplaceFeatures(car)
  const partnerChips = (Array.isArray(car.partner_names) ? car.partner_names : []).map((x) => String(x).trim()).filter(Boolean)

  const weekly = Number(car.weekly_rent_pln ?? 0)
  const isPro = profile?.role === 'admin' || (profile?.role === 'owner' && profile?.plan_tier === 'pro')
  const photoCount = vehiclePhotos.length
  const requiredPhotoCount = VEHICLE_PHOTO_REQUIRED.filter((def) => vehiclePhotos.some((p) => String(p.angle_key) === def.key)).length
  const insuranceDate = effectiveInsuranceExpiryIso(car)
  const inspectionDate = car.przeglad_expiry
  const serviceDate = car.last_service_date
  const driverName = String(car.driver_name || '').trim()
  const carNeedsCheck = docRows.some(({ date, service }) => {
    const st = service ? serviceStatusLabel(typeof date === 'string' ? date : null) : expiryStatusLabel(typeof date === 'string' ? date : null)
    return st.tone === 'red' || st.tone === 'orange'
  })

  function previewDate(isoDate, service = false) {
    if (!isoDate) return t('carDetailMobile.noDate')
    const days = daysUntilDate(isoDate)
    if (days == null) return String(isoDate)
    if (days < 0) return t('carDetailMobile.expired')
    if (days === 0) return t('docDays.today')
    const suffix = service ? t('carDetailMobile.agoOrDue') : ''
    return `${days} ${t('carDetailMobile.daysShort')}${suffix}`
  }

  function previewClass(isoDate, service = false) {
    const st = service ? serviceStatusLabel(typeof isoDate === 'string' ? isoDate : null) : expiryStatusLabel(typeof isoDate === 'string' ? isoDate : null)
    return `car-mobile-tone-${st.tone}`
  }

  function setMobileField(name, value) {
    setMobileForm((prev) => (prev ? { ...prev, [name]: value } : prev))
  }

  function toggleMobileApp(key) {
    setMobileForm((prev) => {
      if (!prev) return prev
      const cur = normalizeAppsAvailable(prev.apps_available)
      const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]
      return { ...prev, apps_available: next }
    })
  }

  function toggleMobilePartner(name) {
    setMobileForm((prev) => {
      if (!prev) return prev
      const cur = normalizePartnerNamesPayload(prev.partner_names)
      const exists = cur.some((x) => x.toLowerCase() === name.toLowerCase())
      return { ...prev, partner_names: exists ? cur.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...cur, name] }
    })
  }

  function mobileSaveFooter(sheet) {
    return (
      <button type="button" className="btn primary car-mobile-save" disabled={mobileSaving} onClick={() => void saveMobileSheet(sheet)}>
        {mobileSaving ? t('carForm.saving') : t('carDetailMobile.save')}
      </button>
    )
  }

  return (
    <div className="page-simple car-detail-page">
      <p className="muted small">
        {isAdmin ? (
          <Link to="/flota" className="link">
            {t('carDetail.backFleet')}
          </Link>
        ) : null}
      </p>

      {formErr ? <p className="form-error">{formErr}</p> : null}

      {isOwner ? (
        <section className="car-mobile-redesign" aria-label={t('carDetailMobile.aria')}>
          <article className="car-mobile-hero">
            {car.primary_photo_url || car.marketplace_photo_url ? (
              <img src={String(car.primary_photo_url || car.marketplace_photo_url)} alt="" className="car-mobile-hero-img" />
            ) : (
              <div className="car-mobile-hero-placeholder" aria-hidden>
                🚗
              </div>
            )}
            <span className={`car-mobile-status-dot ${carNeedsCheck ? 'is-alert' : 'is-ok'}`}>
              {carNeedsCheck ? t('carDetailMobile.check') : t('carDetailMobile.ok')}
            </span>
            <span className="car-mobile-price-badge">
              {weekly.toLocaleString(lc, { maximumFractionDigits: 0 })} zł{t('carDetail.perWeek')}
            </span>
            {photoCount > 0 ? <span className="car-mobile-photo-badge">📸 {photoCount}</span> : null}
            <div className="car-mobile-hero-overlay">
              <strong>{car.plate_number}</strong>
              <span>{[car.model, car.year].filter(Boolean).join(' · ') || '—'}</span>
            </div>
          </article>

          <nav className="car-mobile-status-bar" aria-label={t('carDetailMobile.statusBar')}>
            <button type="button" className="car-mobile-status-pill" onClick={() => setActiveSheet('insurance')}>
              <span>🛡️ {t('carDetailMobile.insurance')}</span>
              <strong className={previewClass(insuranceDate)}>{previewDate(insuranceDate)}</strong>
            </button>
            <button type="button" className="car-mobile-status-pill" onClick={() => setActiveSheet('inspection')}>
              <span>📋 {t('carDetailMobile.inspection')}</span>
              <strong className={previewClass(inspectionDate)}>{previewDate(inspectionDate)}</strong>
            </button>
            <button type="button" className="car-mobile-status-pill" onClick={() => setActiveSheet('service')}>
              <span>🔧 {t('carDetailMobile.service')}</span>
              <strong className={previewClass(serviceDate, true)}>{previewDate(serviceDate, true)}</strong>
            </button>
            <button type="button" className="car-mobile-status-pill" onClick={() => setActiveSheet('driver')}>
              <span>👤 {t('carDetailMobile.driver')}</span>
              <strong>{driverName || t('carDetailMobile.noDriver')}</strong>
            </button>
          </nav>

          <section className="car-mobile-actions card">
            <h2>{t('carDetailMobile.actionTitle')}</h2>
            <div className="car-mobile-action-grid">
              {[
                ['insurance', '🛡️', t('carDetailMobile.insurance'), previewDate(insuranceDate)],
                ['inspection', '📋', t('carDetailMobile.inspection'), inspectionDate || t('carDetailMobile.noDate')],
                ['service', '🔧', t('carDetailMobile.service'), serviceDate || t('carDetailMobile.noDate')],
                ['driver', '👤', t('carDetailMobile.driver'), driverName || t('carDetailMobile.assign')],
                ['photos', '📸', t('carDetailMobile.photos'), t('carDetailMobile.photoProgress', { done: requiredPhotoCount, total: VEHICLE_PHOTO_REQUIRED.length })],
                ['rent', '💰', t('carDetailMobile.rent'), `${weekly.toLocaleString(lc, { maximumFractionDigits: 0 })} zł`],
                ['protocol', '🔄', t('carDetailMobile.protocol'), t('handover.newProtocol')],
                ['rest', '⚙️', t('carDetailMobile.rest'), t('carDetailMobile.moreData')],
              ].map(([key, icon, label, preview]) => (
                <button
                  key={key}
                  type="button"
                  className="car-mobile-action-btn"
                  onClick={() => {
                    if (key === 'protocol') {
                      document.getElementById('car-handover')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      return
                    }
                    setActiveSheet(key)
                  }}
                >
                  <span className="car-mobile-action-icon">{icon}</span>
                  <strong>{label}</strong>
                  <small className={String(preview).toLowerCase().includes(t('carDetailMobile.expired').toLowerCase()) ? 'is-danger' : ''}>{preview}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={`car-mobile-ai-bar ${isPro ? 'is-pro' : 'is-locked'}`}>
            {isPro ? (
              <Link className="car-mobile-ai-input" to={`/ai-manager?carId=${car.id}`} state={{ carId: car.id }}>
                <span>🤖 {t('carDetailMobile.aiPlaceholder')}</span>
                <span aria-hidden>📎</span>
                <span aria-hidden>🎤</span>
              </Link>
            ) : (
              <>
                <p>💡 {t('carDetailMobile.aiLocked')}</p>
                <Link className="link" to="/ustawienia#plan">
                  {t('carDetailMobile.learnMore')}
                </Link>
              </>
            )}
          </section>
        </section>
      ) : null}

      <section className="car-detail-section car-detail-section--public card pad-lg">
        <h2 className="car-detail-section-title">{t('carDetail.sectionPublicTitle')}</h2>
        <p className="muted small car-detail-section-note">{t('carDetail.sectionPublicNote')}</p>

        <div className="car-detail-desktop-gallery">
          <MarketplaceCarPhotoGallery
            carId={String(car.id)}
            primaryFallback={String(car.primary_photo_url || car.marketplace_photo_url || '')}
          />
        </div>

        <header className="car-detail-public-head">
          <p className="car-detail-plate">{car.plate_number}</p>
          <p className="car-detail-model muted">
            {[car.model, car.year].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="car-detail-rent-public">
            {weekly.toLocaleString(lc, { style: 'currency', currency: 'PLN' })}
            <span className="car-detail-rent-unit"> {t('carDetail.perWeek')}</span>
          </p>
          <CarStatusBadge car={car} />
        </header>

        {partnerChips.length ? (
          <div className="car-detail-chip-row" aria-label={t('carDetail.legalPartnerTitle')}>
            {partnerChips.map((name) => (
              <span key={name} className="car-detail-chip car-detail-chip--partner">
                {name}
              </span>
            ))}
          </div>
        ) : partnersLine ? (
          <p className="detail-line">
            <strong>{t('carDetail.legalPartnerPartnersPrefix')}</strong> {partnersLine}
          </p>
        ) : null}

        {partnerContact ? (
          <p className="detail-line">
            <strong>{t('carDetail.legalPartnerContactPrefix')}</strong> {partnerContact}
          </p>
        ) : null}

        <div className="car-detail-apps-row">
          <span className="field-label-lg">{t('carDetail.legalPartnerAppsPrefix')}</span>
          <AppPlatformPills apps={car.apps_available} className="car-detail-app-pills" />
        </div>

        <p className="detail-line">
          <strong>{t('carDetail.legalPartnerRegistrationPrefix')}</strong> {String(car.registration_city ?? 'Warszawa')}
        </p>

        <div className="car-detail-icons-row" aria-label={t('marketplace.iconsAria')}>
          <span title={String(car.fuel_type ?? '')}>{fuelIcon(car.fuel_type)}</span>
          <span title={String(car.transmission ?? '')}>{transmissionIcon(car.transmission)}</span>
          <span title={t('marketplace.seatsTitle')}>🪑 {car.seats ?? '—'}</span>
        </div>

        {feats.length > 0 ? (
          <ul className="car-detail-features">
            {feats.map((key) => (
              <li key={key}>
                <span className="market-check" aria-hidden>
                  ✓
                </span>
                {t(`marketplace.feature.${key}`, { defaultValue: String(key) })}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="car-detail-reqs">
          <p className="market-req-line">
            <strong>{t('marketplace.reqAge')}</strong> {car.min_driver_age ?? '—'}
          </p>
          <p className="market-req-line">
            <strong>{t('marketplace.reqExp')}</strong> {car.min_experience_years ?? '—'} {t('marketplace.reqExpUnit')}
          </p>
          <p className="market-req-line">
            <strong>{t('marketplace.reqRent')}</strong> {car.min_rental_months ?? '—'} {t('marketplace.reqRentUnit')}
          </p>
        </div>
      </section>

      {isOwner ? (
        <>
          <section
            ref={photosSectionRef}
            id="car-photos-marketplace"
            className="car-detail-section car-detail-section--photos car-detail-section--photos-cyber card pad-lg"
          >
            <h2 className="car-detail-section-title">{t('carDetail.sectionPhotosTitle')}</h2>
            <p className="muted small car-detail-section-lead">{t('carDetail.sectionPhotosLead')}</p>
            {user?.id ? <MarketplaceVehiclePhotos car={car} userId={user.id} embed onUpdated={() => refresh()} /> : null}
            {hasDriver ? <p className="muted small">{t('carDetail.marketplaceDriverHint')}</p> : null}
            <label className="toggle-switch toggle-switch--block">
              <input
                type="checkbox"
                checked={listed}
                disabled={hasDriver && !listed}
                onChange={(e) => {
                  setFormErr(null)
                  saveMarketplace({ marketplace_listed: e.target.checked }).catch((err) => {
                    setFormErr(err.message ?? t('errors.generic'))
                  })
                }}
              />
              <span className="toggle-switch-ui" aria-hidden />
              <span className="toggle-switch-text">{t('carDetail.listedToggle')}</span>
            </label>
            {listed && canTurnListingOn && listingForm ? (
              <div className="stack-gap car-detail-listing-fields" key={`mk-${car.id}-${listed}`}>
                <MarketplaceListingFields form={listingForm} setForm={setListingForm} />
                <button type="button" className="btn btn-huge primary" disabled={listingBusy} onClick={saveListingBlock}>
                  {listingBusy ? t('carDetail.savingListing') : t('carDetail.saveListing')}
                </button>
              </div>
            ) : null}
          </section>

          <section className="car-detail-section car-detail-section--private card pad-lg">
            <h2 className="car-detail-section-title car-detail-section-title--private">
              🔒 {t('carDetail.sectionPrivateTitle')}
            </h2>
            <p className="muted small car-detail-section-lead">{t('carDetail.sectionPrivateLead')}</p>

            <h3 className="car-detail-subhead">{t('carDetail.documents')}</h3>
            <ul className="doc-simple-list">
              {docRows.map(({ key, label, date, service }) => {
                const st = service
                  ? serviceStatusLabel(typeof date === 'string' ? date : null)
                  : expiryStatusLabel(typeof date === 'string' ? date : null)
                return (
                  <li key={key} className="doc-simple-row">
                    <div>
                      <p className="doc-simple-name">{label}</p>
                      <p className="muted">{date ? String(date) : '—'}</p>
                    </div>
                    <span className={`status-pill tone-${st.tone}`}>{st.text}</span>
                  </li>
                )
              })}
            </ul>

            <h3 className="car-detail-subhead">{t('carDetail.mileage')}</h3>
            <p className="big-reading">{Number(car.mileage_km ?? 0).toLocaleString(lc)} km</p>
            <div className="mile-inline">
              <input
                className="input input-xl"
                type="number"
                min={0}
                placeholder={t('carDetail.mileagePlaceholder')}
                value={mileageVal}
                onChange={(e) => setMileageVal(e.target.value)}
              />
              <button type="button" className="btn btn-huge primary" disabled={mileBusy} onClick={saveMileage}>
                {t('carDetail.save')}
              </button>
            </div>

            <h3 className="car-detail-subhead">{t('carDetail.monthlyCostsTitle')}</h3>
            <ul className="car-detail-costs muted small">
              <li>
                <strong>{t('carDetail.costInsurance')}</strong>{' '}
                {Number(car.insurance_cost ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}
              </li>
              <li>
                <strong>{t('carDetail.costService')}</strong>{' '}
                {Number(car.service_cost ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}
              </li>
              <li>
                <strong>{t('carDetail.costOther')}</strong>{' '}
                {Number(car.other_costs ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}
              </li>
              <li>
                <strong>{t('carDetail.costFines')}</strong> {Number(car.fines_count ?? 0)}
              </li>
            </ul>

            <p className="detail-line">
              <strong>{t('carDetail.driver')}</strong> {car.driver_name ?? '—'}
            </p>

            <section className="car-detail-applications" aria-label={t('carDetail.applicationsSectionAria')}>
              <h3 className="car-detail-subhead">{t('carDetail.applicationsLead', { count: pendingApps.length })}</h3>
              {pendingAppsLoading ? <LoadingSpinner /> : null}
              {!pendingAppsLoading && pendingApps.length === 0 ? (
                <p className="muted small mb-0">{t('carDetail.applicationsEmpty')}</p>
              ) : null}
              {!pendingAppsLoading && pendingApps.length > 0 ? (
                <ul className="car-detail-applications-list">
                  {pendingApps.map((app) => {
                    const phoneRaw = String(app.driver_phone ?? '').trim()
                    return (
                      <li key={app.id} className="car-detail-application-row">
                        <p className="car-detail-application-name">
                          <strong>{String(app.driver_name ?? '—')}</strong>
                        </p>
                        {phoneRaw ? (
                          <a className="car-detail-application-phone" href={`tel:${phoneRaw.replace(/\s+/g, '')}`}>
                            {phoneRaw}
                          </a>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                        {app.driver_message ? <p className="car-detail-application-msg muted small">{String(app.driver_message)}</p> : null}
                        <p className="muted tiny mb-0">
                          {app.created_at ? new Date(app.created_at).toLocaleString(lc) : ''}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </section>

            {car.notes ? (
              <div className="car-detail-notes">
                <h3 className="car-detail-subhead">{t('carDetail.notesHeading')}</h3>
                <pre className="car-detail-notes-pre muted small">{String(car.notes)}</pre>
              </div>
            ) : null}

            <h3 className="car-detail-subhead">{t('carDetail.history')}</h3>
            {histLoading ? (
              <LoadingSpinner />
            ) : (
              <ul className="mini-hist">
                {entries.slice(0, 8).map((e) => (
                  <li key={e.id} className="muted small">
                    {new Date(e.created_at).toLocaleDateString(lc)} — {e.detail}
                  </li>
                ))}
              </ul>
            )}

            {user?.id ? <HandoverSection car={car} user={user} /> : null}
          </section>

          <div className="car-detail-actions card pad-lg">
            <div className="car-detail-actions-row">
              <button type="button" className="btn btn-huge secondary" onClick={() => setEditOpen(true)}>
                {t('carDetail.editDataCta')}
              </button>
              <button
                type="button"
                className="btn btn-huge secondary"
                onClick={() => photosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {t('carDetail.managePhotosCta')}
              </button>
            </div>
            <div className="car-detail-actions-row">
              <button
                type="button"
                className="btn btn-huge primary"
                onClick={() => document.getElementById('car-handover')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {t('carDetail.newHandoverCta')}
              </button>
              <button type="button" className="btn btn-huge danger" disabled={deleteBusy} onClick={() => void handleDeleteCar()}>
                {deleteBusy ? t('app.loading') : t('carDetail.deleteCarCta')}
              </button>
            </div>
            <button type="button" className="btn btn-huge ghost car-detail-note-btn" onClick={() => setNoteOpen(true)}>
              {t('carDetail.addNote')}
            </button>
          </div>
        </>
      ) : null}

      {isOwner && mobileForm ? (
        <>
          <CarDetailMobileBottomSheet
            open={activeSheet === 'insurance'}
            title={t('carDetailMobile.sheetInsurance')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('insurance')}
          >
            <label className="field">
              <span className="field-label">{t('carDetailMobile.validUntil')}</span>
              <input className="input input-xl" type="date" value={mobileForm.insurance_expiry} onChange={(e) => setMobileField('insurance_expiry', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t('carDetailMobile.monthlyCost')}</span>
              <input className="input input-xl" type="number" min={0} step={1} value={mobileForm.insurance_cost} onChange={(e) => setMobileField('insurance_cost', e.target.value)} />
            </label>
            {isPro ? <Link className="btn ghost" to={`/ai-manager?carId=${car.id}`} state={{ carId: car.id }}>+ {t('carDetailMobile.photoPolicy')}</Link> : null}
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'inspection'}
            title={t('carDetailMobile.sheetInspection')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('inspection')}
          >
            <label className="field">
              <span className="field-label">{t('carDetailMobile.nextInspection')}</span>
              <input className="input input-xl" type="date" value={mobileForm.przeglad_expiry} onChange={(e) => setMobileField('przeglad_expiry', e.target.value)} />
            </label>
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'service'}
            title={t('carDetailMobile.sheetService')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('service')}
          >
            <label className="field">
              <span className="field-label">{t('carDetailMobile.serviceDate')}</span>
              <input className="input input-xl" type="date" value={mobileForm.last_service_date} onChange={(e) => setMobileField('last_service_date', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t('carDetailMobile.serviceCost')}</span>
              <input className="input input-xl" type="number" min={0} step={1} value={mobileForm.service_cost} onChange={(e) => setMobileField('service_cost', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t('carDetailMobile.workDescription')}</span>
              <textarea className="input" rows={3} value={mobileForm.service_note} onChange={(e) => setMobileField('service_note', e.target.value)} />
            </label>
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'driver'}
            title={t('carDetailMobile.sheetDriver')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('driver')}
          >
            <p className="muted small">{t('carDetailMobile.currentDriver')}: <strong>{driverName || t('carDetailMobile.noDriver')}</strong></p>
            <label className="field">
              <span className="field-label">{t('carForm.driverSelect')}</span>
              <select className="input input-xl" value={mobileForm.driver_id} onChange={(e) => setMobileField('driver_id', e.target.value)}>
                <option value="">{t('carForm.driverNone')}</option>
                {drivers.map((d) => {
                  const busyElsewhere = Boolean(d.assigned_to_car_id && String(d.assigned_to_car_id) !== String(car.id))
                  const label = `${d.full_name || '—'}${d.email ? ` · ${d.email}` : ''}${busyElsewhere ? ` ${t('carForm.driverBusySuffix')}` : ''}`
                  return (
                    <option key={d.id} value={d.id} disabled={busyElsewhere}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </label>
            <Link className="btn ghost" to="/marketplace">{t('carDetailMobile.findDriver')}</Link>
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'photos'}
            title={t('carDetailMobile.sheetPhotos')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
          >
            <p className="muted small">{t('carDetailMobile.photoProgress', { done: requiredPhotoCount, total: VEHICLE_PHOTO_REQUIRED.length })}</p>
            {user?.id ? <MarketplaceVehiclePhotos car={car} userId={user.id} embed onUpdated={() => refresh()} /> : null}
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'rent'}
            title={t('carDetailMobile.sheetRent')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('rent')}
          >
            <label className="field">
              <span className="field-label">{t('carForm.rent')}</span>
              <input className="input input-xl" type="number" min={0} step={1} value={mobileForm.weekly_rent_pln} onChange={(e) => setMobileField('weekly_rent_pln', e.target.value)} />
            </label>
            <div className="field">
              <span className="field-label">{t('legalPartner.fleetPartners')}</span>
              <div className="car-mobile-chip-grid">
                {KNOWN_PARTNER_CHIPS.map((name) => {
                  const active = normalizePartnerNamesPayload(mobileForm.partner_names).some((x) => x.toLowerCase() === name.toLowerCase())
                  return (
                    <button key={name} type="button" className={`chip ${active ? 'active' : ''}`} onClick={() => toggleMobilePartner(name)}>
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{t('carForm.appsAvailableLabel')}</span>
              <div className="market-feature-grid">
                {TAXI_APP_ORDER.map((key) => (
                  <label key={key} className="checkbox-line market-feature-check">
                    <input type="checkbox" checked={normalizeAppsAvailable(mobileForm.apps_available).includes(key)} onChange={() => toggleMobileApp(key)} />
                    <span>{t(`taxiApp.${key}`)}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field-label">{t('carForm.registrationCityLabel')}</span>
              <input className="input input-xl" value={mobileForm.registration_city} onChange={(e) => setMobileField('registration_city', e.target.value)} />
            </label>
          </CarDetailMobileBottomSheet>

          <CarDetailMobileBottomSheet
            open={activeSheet === 'rest'}
            title={t('carDetailMobile.sheetRest')}
            closeLabel={t('app.close')}
            onClose={() => setActiveSheet(null)}
            footer={mobileSaveFooter('rest')}
          >
            <label className="field"><span className="field-label">{t('carForm.mileage')}</span><input className="input input-xl" type="number" min={0} value={mobileForm.mileage_km} onChange={(e) => setMobileField('mileage_km', e.target.value)} /></label>
            <label className="field"><span className="field-label">{t('carForm.year')}</span><input className="input input-xl" type="number" min={1970} value={mobileForm.year} onChange={(e) => setMobileField('year', e.target.value)} /></label>
            <label className="field"><span className="field-label">{t('carForm.color')}</span><input className="input input-xl" value={mobileForm.color_label} onChange={(e) => setMobileField('color_label', e.target.value)} /></label>
            <label className="field"><span className="field-label">{t('carForm.fines')}</span><input className="input input-xl" type="number" min={0} value={mobileForm.fines_count} onChange={(e) => setMobileField('fines_count', e.target.value)} /></label>
            <label className="field"><span className="field-label">{t('carForm.notes')}</span><textarea className="input" rows={4} value={mobileForm.notes} onChange={(e) => setMobileField('notes', e.target.value)} /></label>
            <label className="toggle-switch toggle-switch--block">
              <input type="checkbox" checked={Boolean(mobileForm.marketplace_listed)} disabled={hasDriver && !mobileForm.marketplace_listed} onChange={(e) => setMobileField('marketplace_listed', e.target.checked)} />
              <span className="toggle-switch-ui" aria-hidden />
              <span className="toggle-switch-text">{t('carDetail.listedToggle')}</span>
            </label>
            <button type="button" className="btn danger" disabled={deleteBusy} onClick={() => void handleDeleteCar()}>
              {deleteBusy ? t('app.loading') : t('carDetail.deleteCarCta')}
            </button>
          </CarDetailMobileBottomSheet>
        </>
      ) : null}

      {isOwner ? <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={saveNote} /> : null}
      {isOwner ? <CarFormModal open={editOpen} onClose={() => setEditOpen(false)} car={car} drivers={drivers} onSaved={() => refresh()} /> : null}
    </div>
  )
}
