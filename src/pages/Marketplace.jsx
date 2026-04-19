import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCars } from '../hooks/useCars'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Modal } from '../components/Modal'
import { localeTag } from '../utils/localeTag'
import { carPath } from '../lib/carPaths'

/** @param {unknown} model */
function inferCarType(model) {
  const m = String(model ?? '').toLowerCase()
  if (/suv|x5|q7|teren|jeep|tucson|sportage|cr-v|rav4|kodiaq|qashqai/.test(m)) return 'suv'
  if (/van|bus|transit|vivaro|ducato|sprinter|multivan|caravelle|boxer|master|expert|combo|dokker/.test(m)) return 'van'
  if (/sedan|limousine|limo/.test(m)) return 'sedan'
  if (/kombi|estate|wagon|avant|touring|variant|sw|sportwagon/.test(m)) return 'kombi'
  return 'other'
}

export function Marketplace() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { isAdmin, isDriver, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const ownerSectionRef = useRef(null)

  const [driverCars, setDriverCars] = useState([])
  const [driverLoading, setDriverLoading] = useState(true)
  const [driverError, setDriverError] = useState(null)

  const [company, setCompany] = useState({ company_name: '', contact_email: '', contact_phone: '' })
  const [interestCar, setInterestCar] = useState(null)
  const [openContact, setOpenContact] = useState(false)

  const [typeFilter, setTypeFilter] = useState('all')
  const [locFilter, setLocFilter] = useState('all')
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(10_000)
  const [sliderMax, setSliderMax] = useState(5000)
  const boundsInit = useRef(false)

  const {
    cars: ownerCars,
    loading: ownerLoading,
    error: ownerError,
    refresh: refreshOwnerCars,
  } = useCars({ enabled: isAdmin && Boolean(user?.id), ownerId: user?.id ?? null })

  const loadCompany = useCallback(async () => {
    const { data } = await supabase.from('company_settings').select('company_name, contact_email, contact_phone').eq('id', 1).maybeSingle()
    setCompany({
      company_name: data?.company_name != null ? String(data.company_name) : '',
      contact_email: data?.contact_email != null ? String(data.contact_email) : '',
      contact_phone: data?.contact_phone != null ? String(data.contact_phone) : '',
    })
  }, [])

  const loadDriverListings = useCallback(async () => {
    setDriverLoading(true)
    setDriverError(null)
    const { data, error } = await supabase
      .from('cars')
      .select(
        'id, model, year, weekly_rent_pln, marketplace_photo_url, marketplace_description, marketplace_location, plate_number'
      )
      .eq('marketplace_listed', true)
      .is('driver_id', null)
      .order('weekly_rent_pln', { ascending: true })
    if (error) {
      setDriverError(error.message)
      setDriverCars([])
    } else {
      setDriverCars(data ?? [])
    }
    setDriverLoading(false)
  }, [])

  useEffect(() => {
    loadCompany()
  }, [loadCompany])

  useEffect(() => {
    if (isDriver) loadDriverListings()
    else {
      setDriverCars([])
      setDriverLoading(false)
    }
  }, [isDriver, loadDriverListings])

  useEffect(() => {
    if (searchParams.get('manage') !== '1' || !isAdmin || ownerLoading) return undefined
    const t = window.setTimeout(() => {
      ownerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [searchParams, isAdmin, ownerLoading])

  const uniqueLocations = useMemo(() => {
    const s = new Set()
    for (const c of driverCars) {
      const loc = c.marketplace_location != null ? String(c.marketplace_location).trim() : ''
      if (loc) s.add(loc)
    }
    return Array.from(s).sort()
  }, [driverCars])

  useEffect(() => {
    if (!isDriver || !driverCars.length || boundsInit.current) return
    const rents = driverCars.map((c) => Number(c.weekly_rent_pln ?? 0)).filter((n) => Number.isFinite(n))
    const hi = Math.max(...rents, 0)
    const cap = hi > 0 ? Math.ceil(hi / 100) * 100 + 200 : 2000
    setSliderMax(Math.max(500, cap))
    setPriceMax(Math.max(500, cap))
    setPriceMin(0)
    boundsInit.current = true
  }, [isDriver, driverCars])

  const filteredDriverCars = useMemo(() => {
    return driverCars.filter((c) => {
      const w = Number(c.weekly_rent_pln ?? 0)
      if (!Number.isFinite(w) || w < priceMin || w > priceMax) return false
      const loc = c.marketplace_location != null ? String(c.marketplace_location).trim() : ''
      if (locFilter !== 'all' && loc !== locFilter) return false
      if (typeFilter !== 'all' && inferCarType(c.model) !== typeFilter) return false
      return true
    })
  }, [driverCars, priceMin, priceMax, locFilter, typeFilter])

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

  function clearManageParam() {
    if (searchParams.get('manage') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('manage')
      setSearchParams(next, { replace: true })
    }
  }

  const showDriverBrowse = isDriver
  const showOwnerPanel = isAdmin

  return (
    <div className="page-simple marketplace-page">
      <p className="muted small">
        <Link to={isAdmin ? '/panel' : '/'} className="link">
          {isAdmin ? `← ${t('app.panel')}` : `← ${t('app.home')}`}
        </Link>
      </p>

      {showDriverBrowse ? (
        <>
          <header className="market-hero">
            <h1 className="market-hero-title">{t('marketplace.driverHeader')}</h1>
            <p className="muted market-hero-lead">{t('marketplace.driverLead')}</p>
          </header>

          {driverError ? <p className="form-error">{driverError}</p> : null}

          {driverLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <section className="market-filters" aria-label={t('marketplace.filtersAria')}>
                <div className="market-filter-row">
                  <label className="field market-field-compact">
                    <span className="field-label">{t('marketplace.filterType')}</span>
                    <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                      <option value="all">{t('marketplace.typeAll')}</option>
                      <option value="sedan">{t('marketplace.typeSedan')}</option>
                      <option value="suv">{t('marketplace.typeSuv')}</option>
                      <option value="van">{t('marketplace.typeVan')}</option>
                      <option value="kombi">{t('marketplace.typeKombi')}</option>
                      <option value="other">{t('marketplace.typeOther')}</option>
                    </select>
                  </label>
                  <label className="field market-field-compact">
                    <span className="field-label">{t('marketplace.filterLocation')}</span>
                    <select className="input" value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
                      <option value="all">{t('marketplace.locAll')}</option>
                      {uniqueLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="market-range-block">
                  <p className="field-label">{t('marketplace.filterPrice')}</p>
                  <div className="market-range-values muted small">
                    <span>
                      {priceMin.toLocaleString(lc)} — {priceMax.toLocaleString(lc)} PLN
                    </span>
                  </div>
                  <div className="market-dual-range">
                    <label className="market-range-label">
                      <span className="muted small">{t('marketplace.priceMin')}</span>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={50}
                        value={Math.min(priceMin, priceMax)}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPriceMin(Math.min(v, priceMax))
                        }}
                      />
                    </label>
                    <label className="market-range-label">
                      <span className="muted small">{t('marketplace.priceMax')}</span>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={50}
                        value={Math.max(priceMin, priceMax)}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setPriceMax(Math.max(v, priceMin))
                        }}
                      />
                    </label>
                  </div>
                </div>
              </section>

              {filteredDriverCars.length === 0 ? (
                <p className="market-empty muted">{t('marketplace.emptyDriver')}</p>
              ) : (
                <div className="market-grid market-grid--mobile-two">
                  {filteredDriverCars.map((car) => {
                    const title = [car.model || t('marketplace.car'), car.year != null ? String(car.year) : '']
                      .filter(Boolean)
                      .join(' ')
                    const photo = car.marketplace_photo_url ? String(car.marketplace_photo_url).trim() : ''
                    const loc = car.marketplace_location != null ? String(car.marketplace_location).trim() : t('marketplace.locationDefault')
                    return (
                      <article key={car.id} className="market-card market-card-lg">
                        <div className="market-photo market-photo-lg">
                          {photo ? (
                            <img src={photo} alt="" className="market-photo-img" loading="lazy" />
                          ) : (
                            <span aria-hidden>🚕</span>
                          )}
                        </div>
                        <h2 className="market-card-title">{title}</h2>
                        <p className="market-price market-price-lg">
                          {Number(car.weekly_rent_pln ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}
                          <span className="muted small"> {t('marketplace.week')}</span>
                        </p>
                        <div className="market-card-meta">
                          <span className="location-badge">{loc}</span>
                          <span className="market-stars" aria-label={t('marketplace.ratingPlaceholderAria')}>
                            ★★★★★
                          </span>
                        </div>
                        {car.marketplace_description ? (
                          <p className="muted small market-card-desc">{String(car.marketplace_description)}</p>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-huge primary market-card-cta"
                          onClick={() => {
                            setInterestCar(car)
                            setOpenContact(true)
                            loadCompany()
                          }}
                        >
                          {t('marketplace.interest')}
                        </button>
                      </article>
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

      {!isDriver && !isAdmin ? (
        <p className="muted">{t('marketplace.roleUnsupported')}</p>
      ) : null}

      <Modal
        open={openContact}
        title={interestCar ? t('marketplace.contactTitle', { model: interestCar.model || t('marketplace.car') }) : t('marketplace.contactHeading')}
        onClose={() => {
          setOpenContact(false)
          setInterestCar(null)
        }}
      >
        <div className="market-contact-block">
          <p>
            <strong>{t('marketplace.contactCompany')}</strong> {company.company_name || '—'}
          </p>
          <p>
            <strong>{t('marketplace.contactEmail')}</strong>{' '}
            {company.contact_email ? (
              <a href={`mailto:${company.contact_email}`} className="link-strong">
                {company.contact_email}
              </a>
            ) : (
              <span className="muted">{t('marketplace.noEmail')}</span>
            )}
          </p>
          {company.contact_phone ? (
            <p>
              <strong>{t('marketplace.contactPhone')}</strong>{' '}
              <a href={`tel:${company.contact_phone.replace(/\s+/g, '')}`} className="link-strong">
                {company.contact_phone}
              </a>
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-huge primary" onClick={() => { setOpenContact(false); setInterestCar(null) }}>
          {t('app.ok')}
        </button>
      </Modal>
    </div>
  )
}
