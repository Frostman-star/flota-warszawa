import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCars } from '../hooks/useCars'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Modal } from '../components/Modal'
import { MarketplaceCarPhotoZoom } from '../components/MarketplaceCarPhotoZoom'
import { localeTag } from '../utils/localeTag'
import { carPath } from '../lib/carPaths'
import { isDriverProfileCompleteForApply } from '../utils/driverProfile'
import { AppPlatformPills } from '../components/AppPlatformPills'
import { formatAppsReadable, formatPartnerNamesFromCar } from '../utils/partnerApps'
import { VEHICLE_REQUIRED_KEYS } from '../utils/vehiclePhotoAngles'
import { fuelIcon, transmissionIcon, normalizeMarketplaceFeatures } from '../utils/marketplaceDisplay'
import { MarketplaceListedCarArticle } from '../components/MarketplaceListedCarArticle'

const DRIVER_SELECT = `
  id, model, year, weekly_rent_pln, marketplace_photo_url, primary_photo_url, marketplace_description, marketplace_location,
  marketplace_status, deposit_amount, fuel_type, transmission, seats, consumption, marketplace_features,
  min_driver_age, min_experience_years, min_rental_months, owner_phone, owner_telegram,
  plate_number, owner_id, marketplace_view_count,
  partner_names, partner_name, partner_contact, apps_available, registration_city
`

/**
 * @param {Record<string, unknown>} car
 * @param {string} chip
 */
function matchesChip(car, chip) {
  if (chip === 'all') return true
  if (chip === 'hybrid') return String(car.fuel_type || '').toLowerCase() === 'hybryda'
  if (chip === 'automat') return String(car.transmission || '').toLowerCase() === 'automat'
  if (chip === 'seats7')
    return Number(car.seats) >= 7 || normalizeMarketplaceFeatures(car).includes('seats_7')
  if (chip === 'price600') return Number(car.weekly_rent_pln ?? 0) <= 600
  return true
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function partnerNamesFromValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

export function Marketplace() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { isAdmin, isDriver, user, session, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const ownerSectionRef = useRef(null)

  const [driverCars, setDriverCars] = useState([])
  const [driverLoading, setDriverLoading] = useState(true)
  const [driverError, setDriverError] = useState(null)

  const [applyCar, setApplyCar] = useState(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyStep, setApplyStep] = useState('form')
  const [applyMessage, setApplyMessage] = useState('')
  const [applySubmitting, setApplySubmitting] = useState(false)
  const [applyError, setApplyError] = useState(null)
  const [applyOwnerContact, setApplyOwnerContact] = useState(null)
  /** @type {[Record<string, true>, import('react').Dispatch<import('react').SetStateAction<Record<string, true>>>]} */
  const [blockedApplyCars, setBlockedApplyCars] = useState({})

  const [chipFilter, setChipFilter] = useState('all')
  const [selectedPartner, setSelectedPartner] = useState('all')
  const [favoritedIds, setFavoritedIds] = useState(() => new Set())
  const [favToast, setFavToast] = useState('')
  const [contactCar, setContactCar] = useState(null)
  const [catalogPhotoZoom, setCatalogPhotoZoom] = useState(null)
  /** @type {[Record<string, number>, import('react').Dispatch<import('react').SetStateAction<Record<string, number>>>]} */
  const [ownerRequiredPhotoCount, setOwnerRequiredPhotoCount] = useState({})

  const profileApplyReady = isDriverProfileCompleteForApply(profile)
  const showCatalog = Boolean(user?.id)

  const loadMyApplications = useCallback(async () => {
    if (!isDriver || !user?.id) {
      setBlockedApplyCars({})
      return
    }
    const { data, error } = await supabase
      .from('driver_applications')
      .select('car_id,status')
      .eq('driver_id', user.id)
    if (error) return
    const next = {}
    for (const r of data ?? []) {
      const st = String(r.status || '')
      if (st === 'pending' || st === 'accepted') next[String(r.car_id)] = true
    }
    setBlockedApplyCars(next)
  }, [isDriver, user?.id])

  const {
    cars: ownerCars,
    loading: ownerLoading,
    error: ownerError,
    refresh: refreshOwnerCars,
  } = useCars({ enabled: isAdmin && Boolean(user?.id), ownerId: user?.id ?? null })

  const bumpDriverCarViewCount = useCallback((carId) => {
    setDriverCars((prev) =>
      prev.map((c) =>
        String(c.id) === carId
          ? { ...c, marketplace_view_count: Number(c.marketplace_view_count ?? 0) + 1 }
          : c
      )
    )
  }, [])

  const loadDriverListings = useCallback(async () => {
    setDriverLoading(true)
    setDriverError(null)
    const { data, error } = await supabase
      .from('cars')
      .select(DRIVER_SELECT)
      .eq('marketplace_listed', true)
      .is('driver_id', null)
      .order('weekly_rent_pln', { ascending: true })
    if (error) {
      setDriverError(error.message)
      setDriverCars([])
    } else {
      let list = data ?? []
      if (list.length > 0) {
        const ids = list.map((c) => c.id)
        const { data: phRows } = await supabase.from('vehicle_photos').select('vehicle_id, angle_key').in('vehicle_id', ids)
        const total = {}
        for (const id of ids) total[id] = 0
        for (const row of phRows ?? []) {
          const vid = String(row.vehicle_id)
          total[vid] = (total[vid] ?? 0) + 1
        }
        list = list.map((c) => ({
          ...c,
          _photoCount: total[c.id] ?? 0,
        }))
      }
      setDriverCars(list)
      setDriverError(null)
      console.log('All cars:', list)
    }
    setDriverLoading(false)
  }, [])

  useEffect(() => {
    if (showCatalog) void loadDriverListings()
    else {
      setDriverCars([])
      setDriverLoading(false)
    }
  }, [showCatalog, loadDriverListings])

  useEffect(() => {
    void loadMyApplications()
  }, [loadMyApplications])

  useEffect(() => {
    if (!isDriver || !user?.id) {
      setFavoritedIds(new Set())
      return
    }
    let cancelled = false
    void supabase
      .from('driver_favorites')
      .select('vehicle_id')
      .eq('driver_id', user.id)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setFavoritedIds(new Set((data ?? []).map((r) => String(r.vehicle_id))))
      })
    return () => {
      cancelled = true
    }
  }, [isDriver, user?.id])

  useEffect(() => {
    if (!favToast) return undefined
    const timer = window.setTimeout(() => setFavToast(''), 1600)
    return () => window.clearTimeout(timer)
  }, [favToast])

  useEffect(() => {
    if (!ownerCars.length) {
      setOwnerRequiredPhotoCount({})
      return
    }
    let cancelled = false
    const ids = ownerCars.map((c) => c.id)
    void supabase
      .from('vehicle_photos')
      .select('vehicle_id, angle_key')
      .in('vehicle_id', ids)
      .then(({ data }) => {
        if (cancelled) return
        const req = {}
        for (const id of ids) req[id] = 0
        for (const row of data ?? []) {
          const vid = String(row.vehicle_id)
          if (VEHICLE_REQUIRED_KEYS.has(String(row.angle_key))) req[vid] = (req[vid] ?? 0) + 1
        }
        setOwnerRequiredPhotoCount(req)
      })
    return () => {
      cancelled = true
    }
  }, [ownerCars])

  useEffect(() => {
    if (searchParams.get('manage') !== '1' || !isAdmin || ownerLoading) return undefined
    const tmr = window.setTimeout(() => {
      ownerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(tmr)
  }, [searchParams, isAdmin, ownerLoading])

  const filteredDriverCars = useMemo(() => {
    return driverCars.filter((c) => {
      if (!matchesChip(c, chipFilter)) return false
      if (selectedPartner === 'all') return true
      const names = [
        ...partnerNamesFromValue(c.partner_names),
        ...partnerNamesFromValue(typeof c.partner_name === 'string' ? c.partner_name : ''),
      ]
      return names.includes(selectedPartner)
    })
  }, [driverCars, chipFilter, selectedPartner])

  const partnerOptions = useMemo(() => {
    const allPartners = []
    for (const car of driverCars) {
      if (Array.isArray(car.partner_names)) {
        for (const p of car.partner_names) {
          const name = String(p ?? '').trim()
          if (name && !allPartners.includes(name)) allPartners.push(name)
        }
      } else {
        const legacy = String(car.partner_name ?? '').trim()
        if (legacy && !allPartners.includes(legacy)) allPartners.push(legacy)
      }
    }
    console.log('All partners found:', allPartners)
    return allPartners.sort((a, b) => a.localeCompare(b, lc))
  }, [driverCars, lc])
  const hasPartnerFilter = selectedPartner !== 'all'

  useEffect(() => {
    console.log('Selected partner:', selectedPartner)
  }, [selectedPartner])

  async function setOwnerListed(car, listed) {
    if (!user?.id) return
    if (car.driver_id && listed) return
    try {
      const { error } = await supabase
        .from('cars')
        .update({
          marketplace_listed: listed,
          show_in_marketplace: listed,
          marketplace_status: listed ? 'dostepne' : 'zajete',
        })
        .eq('id', car.id)
        .eq('owner_id', user.id)
      if (error) throw error
      await refreshOwnerCars()
    } catch (e) {
      console.error(e)
    }
  }

  async function toggleFavorite(carId) {
    if (!isDriver || !user?.id) return
    const id = String(carId)
    const isFav = favoritedIds.has(id)
    if (isFav) {
      const { error } = await supabase.from('driver_favorites').delete().eq('driver_id', user.id).eq('vehicle_id', id)
      if (error) return
      setFavoritedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setFavToast(t('favorites.removedToast'))
      return
    }
    const { error } = await supabase.from('driver_favorites').insert({ driver_id: user.id, vehicle_id: id })
    if (error) return
    setFavoritedIds((prev) => new Set(prev).add(id))
    setFavToast(t('favorites.addedToast'))
  }

  function clearManageParam() {
    if (searchParams.get('manage') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('manage')
      setSearchParams(next, { replace: true })
    }
  }

  const chips = useMemo(
    () => [
      { id: 'all', label: t('marketplace.chipAll') },
      { id: 'hybrid', label: t('marketplace.chipHybrid') },
      { id: 'automat', label: t('marketplace.chipAutomat') },
      { id: 'seats7', label: t('marketplace.chipSeats7') },
      { id: 'price600', label: t('marketplace.chipPrice600') },
    ],
    [t]
  )

  const submitApplication = useCallback(async () => {
    if (!isDriver || !applyCar || !user?.id || !profile) return
    const ownerId = applyCar.owner_id
    if (!ownerId) {
      setApplyError('missing_owner')
      return
    }
    setApplySubmitting(true)
    setApplyError(null)
    const { data: ins, error } = await supabase
      .from('driver_applications')
      .insert({
        car_id: applyCar.id,
        driver_id: user.id,
        owner_id: ownerId,
        status: 'pending',
        lead_source: 'cario_marketplace',
        driver_name: String(profile.full_name ?? '').trim(),
        driver_phone: String(profile.phone ?? '').trim(),
        driver_message: applyMessage.trim() || null,
      })
      .select('id')
      .maybeSingle()
    setApplySubmitting(false)
    if (error) {
      setApplyError(error.message)
      return
    }
    const fallbackCompany = formatPartnerNamesFromCar(applyCar) || t('publicFleet.defaultCompany')
    let ownerContact = {
      company: fallbackCompany,
      phone: String(applyCar.owner_phone ?? '').trim(),
      telegram: String(applyCar.owner_telegram ?? '').trim(),
      email: '',
    }
    try {
      const { data: cs } = await supabase
        .from('company_settings')
        .select('company_name, contact_email')
        .eq('id', 1)
        .maybeSingle()
      ownerContact = {
        ...ownerContact,
        company: String(cs?.company_name ?? '').trim() || ownerContact.company,
        email: String(cs?.contact_email ?? '').trim(),
      }
    } catch {
      // fallback to car contact fields only
    }
    setApplyOwnerContact(ownerContact)
    if (session?.access_token && ins?.id) {
      try {
        await supabase.functions.invoke('notify-driver-application', {
          body: {
            event: 'new_application',
            application_id: ins.id,
            title: t('marketplace.pushNewApplicationTitle', {
              plate: String(applyCar.plate_number ?? '').trim() || '—',
            }),
            body: `${String(profile.full_name ?? '').trim()} · ${String(profile.phone ?? '').trim()}`,
            open_url: '/wnioski',
            driver_name: String(profile.full_name ?? '').trim(),
            driver_phone: String(profile.phone ?? '').trim(),
            driver_message: applyMessage.trim() || '',
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch {
        /* brak wdrożonej funkcji */
      }
    }
    setApplyStep('success')
    setBlockedApplyCars((prev) => ({ ...prev, [String(applyCar.id)]: true }))
    void loadMyApplications()
  }, [isDriver, applyCar, user?.id, profile, applyMessage, session?.access_token, loadMyApplications, t])

  function formatWeekly(car) {
    const n = Math.round(Number(car.weekly_rent_pln ?? 0))
    return `${n.toLocaleString(lc)} zł / ${t('marketplace.weekShort')}`
  }

  const showOwnerPanel = isAdmin

  function telegramHref(handle) {
    const h = String(handle || '').trim().replace(/^@+/, '')
    if (!h) return null
    return `https://t.me/${encodeURIComponent(h)}`
  }

  return (
    <div className="page-simple marketplace-page market-catalog-page">
      <p className="muted small">
        <Link to={isAdmin ? '/panel' : '/'} className="link">
          {isAdmin ? `← ${t('app.panel')}` : `← ${t('app.home')}`}
        </Link>
      </p>

      {showCatalog ? (
        <>
          <header className="market-catalog-header">
            <div className="market-catalog-title-row">
              <h1 className="market-catalog-title">{t('marketplace.catalogTitle')}</h1>
              <span className="market-catalog-count" aria-live="polite">
                {filteredDriverCars.length}
              </span>
            </div>
          </header>

          {isDriver && !profileApplyReady ? (
            <div className="profile-banner warn" role="status">
              {t('marketplace.profileIncompleteApplyBanner')}{' '}
              <Link to="/profil" className="link-strong">
                {t('marketplace.profileIncompleteCta')}
              </Link>
            </div>
          ) : null}

          {driverError ? <p className="form-error">{driverError}</p> : null}

          {driverLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <p className="muted small">{t('marketplace.partnerFilterLabel')}</p>
              <div className="market-chip-scroll" role="tablist" aria-label={t('marketplace.chipsAria')}>
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={chipFilter === c.id}
                    className={`market-chip${chipFilter === c.id ? ' market-chip--active' : ''}`}
                    onClick={() => setChipFilter(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {partnerOptions.length > 0 ? (
                <>
                  <p className="muted small">{t('marketplace.partnerLabel')}:</p>
                  <div className="market-chip-scroll" role="tablist" aria-label={t('marketplace.partnerFilterLabel')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedPartner === 'all'}
                    className="market-chip"
                    style={{
                      background: selectedPartner === 'all' ? '#2563eb' : 'rgba(255,255,255,0.08)',
                      color: selectedPartner === 'all' ? '#fff' : '#9ca3af',
                    }}
                    onClick={() => setSelectedPartner('all')}
                  >
                    {t('marketplace.allPartners')}
                  </button>
                  {partnerOptions.map((partner) => (
                    <button
                      key={`partner-${partner}`}
                      type="button"
                      role="tab"
                      aria-selected={selectedPartner === partner}
                      className="market-chip"
                      style={{
                        background: selectedPartner === partner ? '#2563eb' : 'rgba(255,255,255,0.08)',
                        color: selectedPartner === partner ? '#fff' : '#9ca3af',
                      }}
                      onClick={() => setSelectedPartner(partner)}
                    >
                      {partner}
                    </button>
                  ))}
                  </div>
                </>
              ) : null}
              {hasPartnerFilter ? (
                <div className="market-chip-scroll" aria-label={t('marketplace.partnerFilterLabel')}>
                  <button type="button" className="market-chip market-chip--active" onClick={() => setSelectedPartner('all')}>
                    {t('marketplace.partnerLabel')}: {selectedPartner} ×
                  </button>
                </div>
              ) : null}

              {driverCars.length === 0 ? (
                <p className="market-empty market-empty-lg">{t('marketplace.emptyDriver')}</p>
              ) : hasPartnerFilter && filteredDriverCars.length === 0 ? (
                <p className="market-empty muted">{t('marketplace.filteredEmptyPartner')}</p>
              ) : filteredDriverCars.length === 0 ? (
                <p className="market-empty muted">{t('marketplace.filteredEmpty')}</p>
              ) : (
                <div className="market-catalog-list">
                  {filteredDriverCars.map((car) => {
                    const title = [car.model || t('marketplace.car'), car.year != null ? String(car.year) : '']
                      .filter(Boolean)
                      .join(' ')
                    const photo = String(car.primary_photo_url || car.marketplace_photo_url || '')
                      .trim()
                    const photoCount = Number(car._photoCount ?? 0)
                    const available = String(car.marketplace_status || '') === 'dostepne'
                    const feats = normalizeMarketplaceFeatures(car)
                    const dep = Number(car.deposit_amount ?? 0)
                    const isFavorited = favoritedIds.has(String(car.id))
                    return (
                      <MarketplaceListedCarArticle
                        key={car.id}
                        carId={String(car.id)}
                        pingEnabled={showCatalog}
                        onViewRecorded={bumpDriverCarViewCount}
                        className="market-catalog-card"
                      >
                        <div className="market-catalog-photo-wrap">
                          {isDriver ? (
                            <button
                              type="button"
                              className="btn ghost small"
                              style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', zIndex: 2 }}
                              onClick={() => void toggleFavorite(car.id)}
                              aria-label={isFavorited ? t('favorites.remove') : t('favorites.add')}
                            >
                              <span style={{ color: isFavorited ? '#ef4444' : '#9ca3af' }}>{isFavorited ? '❤️' : '♡'}</span>
                            </button>
                          ) : null}
                          {photo ? (
                            <button
                              type="button"
                              className="market-catalog-photo-hit"
                              onClick={() => setCatalogPhotoZoom({ id: String(car.id), fallback: photo })}
                              aria-label={t('photoFullscreen.open')}
                            >
                              <img src={photo} alt="" className="market-catalog-photo market-catalog-photo--hero" loading="lazy" />
                            </button>
                          ) : (
                            <div className="market-catalog-photo market-catalog-photo--ph" aria-hidden>
                              <span>🚗</span>
                            </div>
                          )}
                          {photoCount > 0 ? (
                            <span className="market-catalog-photo-count">
                              📸 {t('marketplacePhotos.photoCount', { count: photoCount })}
                            </span>
                          ) : null}
                          <span className={`market-status-badge${available ? ' market-status-badge--ok' : ''}`}>
                            {available ? t('marketplace.badgeAvailable') : t('marketplace.badgeTaken')}
                          </span>
                        </div>
                        <div className="market-catalog-body">
                          <h2 className="market-catalog-model">{title}</h2>
                          <p className="market-catalog-price">{formatWeekly(car)}</p>
                          <p className="muted small market-catalog-views" aria-label={t('marketplace.viewCountAria', { count: Number(car.marketplace_view_count ?? 0).toLocaleString(lc) })}>
                            {t('marketplace.viewCountLine', { count: Number(car.marketplace_view_count ?? 0).toLocaleString(lc) })}
                          </p>
                          {dep > 0 ? (
                            <p className="market-catalog-deposit muted">
                              {t('marketplace.deposit', { amount: dep.toLocaleString(lc) })}
                            </p>
                          ) : null}
                          <div className="market-legal-partner-block" aria-label={t('carDetail.legalPartnerTitle')}>
                            <p className="market-legal-partner-line">
                              🏢 {t('marketplace.legalPartnerPartnersRow', {
                                names: formatPartnerNamesFromCar(car) || '—',
                              })}
                            </p>
                            <p className="market-legal-partner-line">
                              📱 {t('marketplace.legalPartnerAppsRow', {
                                apps: formatAppsReadable(car.apps_available, t) || '—',
                              })}
                            </p>
                            <p className="market-legal-partner-line">
                              📍 {t('marketplace.legalPartnerRegRow', {
                                city: String(car.registration_city ?? '').trim() || 'Warszawa',
                              })}
                            </p>
                          </div>
                          <AppPlatformPills apps={car.apps_available} className="market-catalog-app-pills" />
                          <div className="market-catalog-icons" aria-label={t('marketplace.iconsAria')}>
                            <span title={String(car.fuel_type ?? '')}>{fuelIcon(car.fuel_type)}</span>
                            <span title={String(car.transmission ?? '')}>{transmissionIcon(car.transmission)}</span>
                            <span title={t('marketplace.seatsTitle')}>🪑 {car.seats ?? '—'}</span>
                          </div>
                          {feats.length > 0 ? (
                            <ul className="market-catalog-features">
                              {feats.map((key) => (
                                <li key={key}>
                                  <span className="market-check" aria-hidden>
                                    ✓
                                  </span>
                                  {t(`marketplace.feature.${key}`)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="market-catalog-reqs">
                            <p className="market-req-line">
                              <strong>{t('marketplace.reqAge')}</strong> {car.min_driver_age ?? '—'}
                            </p>
                            <p className="market-req-line">
                              <strong>{t('marketplace.reqExp')}</strong> {car.min_experience_years ?? '—'}{' '}
                              {t('marketplace.reqExpUnit')}
                            </p>
                            <p className="market-req-line">
                              <strong>{t('marketplace.reqRent')}</strong> {car.min_rental_months ?? '—'}{' '}
                              {t('marketplace.reqRentUnit')}
                            </p>
                          </div>
                          {isDriver ? (
                            <button
                              type="button"
                              className="btn btn-huge primary market-catalog-cta"
                              disabled={!profileApplyReady || Boolean(blockedApplyCars[String(car.id)])}
                              onClick={() => {
                                if (!profileApplyReady || blockedApplyCars[String(car.id)]) return
                                setApplyCar(car)
                                setApplyOpen(true)
                                setApplyStep('form')
                                setApplyMessage('')
                                setApplyError(null)
                              }}
                            >
                              {blockedApplyCars[String(car.id)]
                                ? t('marketplace.applicationSentWait')
                                : t('marketplace.applyCta')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-huge secondary market-catalog-cta"
                              onClick={() => setContactCar(car)}
                            >
                              {t('marketplace.contactCta')}
                            </button>
                          )}
                        </div>
                      </MarketplaceListedCarArticle>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {showOwnerPanel ? (
        <section ref={ownerSectionRef} className="market-owner-panel">
          <div className="market-owner-head">
            <h1 className="market-owner-title">{t('marketplace.ownerTitle')}</h1>
            {searchParams.get('manage') === '1' ? (
              <button type="button" className="btn ghost small" onClick={clearManageParam}>
                {t('marketplace.ownerDismissHint')}
              </button>
            ) : null}
          </div>
          <p className="muted">{t('marketplace.ownerLead')}</p>
          {ownerError ? <p className="form-error">{ownerError}</p> : null}
          {ownerLoading ? (
            <LoadingSpinner />
          ) : (
            <ul className="market-owner-list">
              {ownerCars.map((car) => (
                <li key={car.id} className="market-owner-row">
                  <div className="market-owner-info">
                    <strong>{car.plate_number}</strong>
                    <span className="muted small">
                      {car.model || '—'} · {car.year ?? '—'}
                    </span>
                    {(() => {
                      const req = ownerRequiredPhotoCount[car.id] ?? 0
                      const listed = Boolean(car.marketplace_listed)
                      const q = req <= 0 ? 'none' : req >= 4 && listed ? 'ready' : 'partial'
                      return (
                        <p className="market-owner-photo-q muted small">
                          {t(`marketplacePhotos.quality.${q}`)}
                          {q === 'none' ? <> — {t('marketplacePhotos.qualityTipNone')}</> : null}
                        </p>
                      )
                    })()}
                  </div>
                  <label className="toggle-switch toggle-switch--inline">
                    <input
                      type="checkbox"
                      checked={Boolean(car.marketplace_listed)}
                      disabled={Boolean(car.driver_id) && !car.marketplace_listed}
                      onChange={(e) => setOwnerListed(car, e.target.checked)}
                    />
                    <span className="toggle-switch-ui" aria-hidden />
                    <span className="toggle-switch-text">{t('marketplace.listedToggle')}</span>
                  </label>
                  <Link to={carPath(car.id, true)} className="btn secondary small">
                    {t('marketplace.ownerOpenCar')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {catalogPhotoZoom ? (
        <MarketplaceCarPhotoZoom
          carId={catalogPhotoZoom.id}
          fallbackUrl={catalogPhotoZoom.fallback}
          onClose={() => setCatalogPhotoZoom(null)}
        />
      ) : null}

      <Modal
        open={Boolean(contactCar)}
        title={
          contactCar
            ? t('marketplace.contact', { plate: String(contactCar.plate_number ?? '').trim() || t('marketplace.car') })
            : ''
        }
        onClose={() => setContactCar(null)}
        footer={
          <button type="button" className="btn primary" onClick={() => setContactCar(null)}>
            {t('app.close')}
          </button>
        }
      >
        {contactCar ? (
          <div className="stack-form">
            {String(contactCar.owner_phone ?? '').trim() ? (
              <p>
                <a className="link-strong" href={`tel:${String(contactCar.owner_phone).replace(/\s+/g, '')}`}>
                  {String(contactCar.owner_phone).trim()}
                </a>
              </p>
            ) : null}
            {String(contactCar.owner_telegram ?? '').trim() ? (
              <p>
                {telegramHref(contactCar.owner_telegram) ? (
                  <a
                    className="link-strong"
                    href={telegramHref(contactCar.owner_telegram) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {String(contactCar.owner_telegram).trim()}
                  </a>
                ) : (
                  <span className="link-strong">{String(contactCar.owner_telegram).trim()}</span>
                )}
              </p>
            ) : null}
            {!String(contactCar.owner_phone ?? '').trim() && !String(contactCar.owner_telegram ?? '').trim() ? (
              <p className="muted">{t('marketplace.contactEmpty')}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={applyOpen && Boolean(applyCar)}
        title={
          applyCar
            ? t('marketplace.applyTitle', {
                plate: String(applyCar.plate_number ?? '').trim() || applyCar.model || t('marketplace.car'),
              })
            : ''
        }
        onClose={() => {
          setApplyOpen(false)
          setApplyCar(null)
          setApplyStep('form')
          setApplyError(null)
          setApplyOwnerContact(null)
        }}
      >
        {applyStep === 'success' ? (
          <div className="apply-modal-success">
            <p className="apply-success">{t('marketplace.applySentContactPrompt')}</p>
            {applyOwnerContact ? (
              <div className="stack-form">
                <p>
                  <strong>{applyOwnerContact.company || '—'}</strong>
                </p>
                {applyOwnerContact.phone ? (
                  <p>
                    <a className="link-strong" href={`tel:${applyOwnerContact.phone.replace(/\s+/g, '')}`}>
                      {applyOwnerContact.phone}
                    </a>
                  </p>
                ) : null}
                {applyOwnerContact.telegram ? (
                  <p>
                    {telegramHref(applyOwnerContact.telegram) ? (
                      <a
                        className="link-strong"
                        href={telegramHref(applyOwnerContact.telegram) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {applyOwnerContact.telegram}
                      </a>
                    ) : (
                      <span className="link-strong">{applyOwnerContact.telegram}</span>
                    )}
                  </p>
                ) : null}
                {applyOwnerContact.email ? (
                  <p>
                    <a className="link-strong" href={`mailto:${applyOwnerContact.email}`}>
                      {applyOwnerContact.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-huge primary"
              onClick={() => {
                setApplyOpen(false)
                setApplyCar(null)
                setApplyStep('form')
                setApplyOwnerContact(null)
              }}
            >
              {t('app.ok')}
            </button>
          </div>
        ) : (
          <div className="apply-modal-form stack-form">
            <p className="muted small">{t('marketplace.applyPrefillHint')}</p>
            <p className="apply-prefill-name">
              <strong>{String(profile?.full_name ?? '')}</strong>
            </p>
            <p className="muted apply-prefill-phone">{String(profile?.phone ?? '')}</p>
            <label className="field-label-lg" htmlFor="apply-msg">
              {t('marketplace.applyMessageLabel')}
            </label>
            <textarea
              id="apply-msg"
              className="input input-textarea"
              rows={4}
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
            />
            {applyError ? (
              <p className="form-error">
                {applyError === 'missing_owner' ? t('errors.applicationOwnerMissing') : applyError}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-huge primary"
              disabled={applySubmitting || !profileApplyReady}
              onClick={() => void submitApplication()}
            >
              {applySubmitting ? t('app.loading') : t('marketplace.applySubmit')}
            </button>
          </div>
        )}
      </Modal>
      {favToast ? <div className="services-toast" role="status">{favToast}</div> : null}
    </div>
  )
}
