import { useEffect, useMemo, useState } from 'react'
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
import { formatAppsReadable } from '../utils/partnerApps'

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
  const { entries, loading: histLoading, refresh: refreshHist } = useCarHistory(car?.id ?? null)

  const [mileageVal, setMileageVal] = useState('')
  const [mileBusy, setMileBusy] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const [listingForm, setListingForm] = useState(null)
  const [listingBusy, setListingBusy] = useState(false)

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

  const hasDriver = Boolean(car.driver_id)
  const listed = Boolean(car.marketplace_listed)
  const canTurnListingOn = !hasDriver

  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const partnerName = String(car.partner_name ?? '').trim()
  const partnerContact = String(car.partner_contact ?? '').trim()

  return (
    <div className="page-simple car-detail-simple">
      <p className="muted small">
        {isAdmin ? (
          <Link to="/flota" className="link">
            {t('carDetail.backFleet')}
          </Link>
        ) : null}
      </p>

      <header className="detail-header-simple">
        <h1>{car.plate_number}</h1>
        <p className="muted lead">{car.model || '—'}</p>
        <p className="detail-line">
          <strong>{t('carDetail.driver')}</strong> {car.driver_name ?? '—'}
        </p>
        <p className="detail-line">
          <strong>{t('carDetail.rent')}</strong>{' '}
          {Number(car.weekly_rent_pln ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}{' '}
          <span className="muted">{t('carDetail.perWeek')}</span>
        </p>
        <CarStatusBadge car={car} />
      </header>

      <section className="detail-block">
        <h2>{t('carDetail.legalPartnerTitle')}</h2>
        <p className="detail-line legal-partner-line">
          {partnerName || partnerContact ? (
            <>
              {partnerName ? (
                <>
                  <strong>{t('carDetail.legalPartnerPartnerPrefix')}</strong> {partnerName}
                </>
              ) : null}
              {partnerName && partnerContact ? <span className="legal-partner-sep"> | </span> : null}
              {partnerContact ? (
                <>
                  <strong>{t('carDetail.legalPartnerContactPrefix')}</strong> {partnerContact}
                </>
              ) : null}
            </>
          ) : (
            <span className="muted">—</span>
          )}
        </p>
        <p className="detail-line">
          <strong>{t('carDetail.legalPartnerAppsPrefix')}</strong>{' '}
          {formatAppsReadable(car.apps_available, t) || <span className="muted">—</span>}
        </p>
        <p className="detail-line">
          <strong>{t('carDetail.legalPartnerRegistrationPrefix')}</strong>{' '}
          {String(car.registration_city ?? 'Warszawa')}
        </p>
      </section>

      <section className="detail-block">
        <h2>{t('carDetail.documents')}</h2>
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
      </section>

      {isAdmin ? (
        <>
          <section className="detail-block">
            <h2>{t('carDetail.mileage')}</h2>
            <p className="big-reading">{Number(car.mileage_km ?? 0).toLocaleString(lc)} km</p>
            {formErr ? <p className="form-error">{formErr}</p> : null}
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
          </section>

          <section className="detail-block actions-stack">
            <button type="button" className="btn btn-huge secondary" onClick={() => setNoteOpen(true)}>
              {t('carDetail.addNote')}
            </button>
            <button type="button" className="btn btn-huge secondary" onClick={() => setEditOpen(true)}>
              {t('carDetail.editCar')}
            </button>
          </section>

          <section className="detail-block">
            <h2>{t('carDetail.marketplace')}</h2>
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
              <div className="stack-gap" style={{ marginTop: '1rem' }} key={`mk-${car.id}-${listed}`}>
                <MarketplaceListingFields form={listingForm} setForm={setListingForm} />
                <button type="button" className="btn btn-huge primary" disabled={listingBusy} onClick={saveListingBlock}>
                  {listingBusy ? t('carDetail.savingListing') : t('carDetail.saveListing')}
                </button>
              </div>
            ) : null}
          </section>

          {user?.id ? <HandoverSection car={car} user={user} /> : null}
        </>
      ) : null}

      <section className="detail-block">
        <h2>{t('carDetail.history')}</h2>
        {histLoading ? (
          <LoadingSpinner />
        ) : (
          <ul className="mini-hist">
            {entries.slice(0, 5).map((e) => (
              <li key={e.id} className="muted small">
                {new Date(e.created_at).toLocaleDateString(lc)} — {e.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <NoteModal open={noteOpen} onClose={() => setNoteOpen(false)} onSave={saveNote} />
      <CarFormModal open={editOpen} onClose={() => setEditOpen(false)} car={car} drivers={drivers} onSaved={() => refresh()} />
    </div>
  )
}
