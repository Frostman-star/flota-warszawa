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
import { useDrivers } from '../hooks/useDrivers'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { expiryStatusLabel, serviceStatusLabel } from '../utils/docLabels'
import { localeTag } from '../utils/localeTag'
import { formatAppsReadable, formatPartnerNamesFromCar } from '../utils/partnerApps'
import { MarketplaceVehiclePhotos } from '../components/MarketplaceVehiclePhotos'
import { MarketplaceCarPhotoGallery } from '../components/MarketplaceCarPhotoGallery'
import { AppPlatformPills } from '../components/AppPlatformPills'
import { fuelIcon, transmissionIcon, normalizeMarketplaceFeatures } from '../utils/marketplaceDisplay'

export function CarDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { isAdmin, user } = useAuth()
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

  useEffect(() => {
    if (!car) {
      setListingForm(null)
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
  }, [car?.id, car?.updated_at])

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

      <section className="car-detail-section car-detail-section--public card pad-lg">
        <h2 className="car-detail-section-title">{t('carDetail.sectionPublicTitle')}</h2>
        <p className="muted small car-detail-section-note">{t('carDetail.sectionPublicNote')}</p>

        <MarketplaceCarPhotoGallery
          carId={String(car.id)}
          primaryFallback={String(car.primary_photo_url || car.marketplace_photo_url || '')}
        />

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
          <section ref={photosSectionRef} id="car-photos-marketplace" className="car-detail-section car-detail-section--photos card pad-lg">
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

      {isOwner ? <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={saveNote} /> : null}
      {isOwner ? <CarFormModal open={editOpen} onClose={() => setEditOpen(false)} car={car} drivers={drivers} onSaved={() => refresh()} /> : null}
    </div>
  )
}
