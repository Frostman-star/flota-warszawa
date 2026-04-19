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

const DRIVER_SELECT = `
  id, model, year, weekly_rent_pln, marketplace_photo_url, marketplace_description, marketplace_location,
  marketplace_status, deposit_amount, fuel_type, transmission, seats, consumption, marketplace_features,
  min_driver_age, min_experience_years, min_rental_months, owner_phone, owner_telegram
`

/** @param {unknown} ft */
function fuelIcon(ft) {
  switch (String(ft || '').toLowerCase()) {
    case 'hybryda':
      return '🔋'
    case 'elektryczny':
      return '⚡'
    case 'gaz':
      return '💨'
    case 'diesel':
      return '⛽'
    default:
      return '⛽'
  }
}

/** @param {unknown} tr */
function transmissionIcon(tr) {
  return String(tr || '').toLowerCase() === 'manualna' ? '⚙️' : '🅰️'
}

/** @param {unknown} handle */
function telegramHref(handle) {
  const h = String(handle || '').trim().replace(/^@/, '')
  return h ? `https://t.me/${encodeURIComponent(h)}` : ''
}

/** @param {Record<string, unknown>} car */
function normalizeFeatures(car) {
  const f = car.marketplace_features
  if (!Array.isArray(f)) return []
  return f.map((x) => String(x))
}

/**
 * @param {Record<string, unknown>} car
 * @param {string} chip
 */
function matchesChip(car, chip) {
  if (chip === 'all') return true
  if (chip === 'hybrid') return String(car.fuel_type || '').toLowerCase() === 'hybryda'
  if (chip === 'automat') return String(car.transmission || '').toLowerCase() === 'automat'
  if (chip === 'seats7')
    return Number(car.seats) >= 7 || normalizeFeatures(car).includes('seats_7')
  if (chip === 'price600') return Number(car.weekly_rent_pln ?? 0) <= 600
  return true
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

  const [company, setCompany] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    contact_telegram: '',
  })
  const [interestCar, setInterestCar] = useState(null)
  const [openContact, setOpenContact] = useState(false)

  const [chipFilter, setChipFilter] = useState('all')

  const {
    cars: ownerCars,
    loading: ownerLoading,
    error: ownerError,
    refresh: refreshOwnerCars,
  } = useCars({ enabled: isAdmin && Boolean(user?.id), ownerId: user?.id ?? null })

  const loadCompany = useCallback(async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('company_name, contact_email, contact_phone, contact_telegram')
      .eq('id', 1)
      .maybeSingle()
    setCompany({
      company_name: data?.company_name != null ? String(data.company_name) : '',
      contact_email: data?.contact_email != null ? String(data.contact_email) : '',
      contact_phone: data?.contact_phone != null ? String(data.contact_phone) : '',
      contact_telegram: data?.contact_telegram != null ? String(data.contact_telegram) : '',
    })
  }, [])

  const loadDriverListings = useCallback(async () => {
    setDriverLoading(true)
    setDriverError(null)
    const rpc = await supabase.rpc('get_marketplace_listings')
    if (!rpc.error) {
      setDriverCars(Array.isArray(rpc.data) ? rpc.data : [])
      setDriverError(null)
    } else {
      const fb = await supabase
        .from('cars')
        .select(DRIVER_SELECT)
        .eq('marketplace_listed', true)
        .is('driver_id', null)
        .order('weekly_rent_pln', { ascending: true })
      if (fb.error) {
        setDriverError(fb.error.message)
        setDriverCars([])
      } else {
        setDriverCars(fb.data ?? [])
        setDriverError(null)
      }
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
    const tmr = window.setTimeout(() => {
      ownerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(tmr)
  }, [searchParams, isAdmin, ownerLoading])

  const filteredDriverCars = useMemo(() => {
    return driverCars.filter((c) => matchesChip(c, chipFilter))
  }, [driverCars, chipFilter])

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

  const mergedPhone = interestCar
    ? String(interestCar.owner_phone ?? '').trim() || company.contact_phone.trim()
    : company.contact_phone.trim()
  const mergedTelegram = interestCar
    ? String(interestCar.owner_telegram ?? '').trim() || company.contact_telegram.trim()
    : company.contact_telegram.trim()
  const mergedEmail = company.contact_email.trim()

  function formatWeekly(car) {
    const n = Math.round(Number(car.weekly_rent_pln ?? 0))
    return `${n.toLocaleString(lc)} zł / ${t('marketplace.weekShort')}`
  }

  const showDriverBrowse = isDriver
  const showOwnerPanel = isAdmin

  return (
    <div className="page-simple marketplace-page market-catalog-page">
      <p className="muted small">
        <Link to={isAdmin ? '/panel' : '/'} className="link">
          {isAdmin ? `← ${t('app.panel')}` : `← ${t('app.home')}`}
        </Link>
      </p>

      {showDriverBrowse ? (
        <>
          <header className="market-catalog-header">
            <div className="market-catalog-title-row">
              <h1 className="market-catalog-title">{t('marketplace.driverHeader')}</h1>
              <span className="market-catalog-count" aria-live="polite">
                {filteredDriverCars.length}
              </span>
            </div>
          </header>

          {driverError ? <p className="form-error">{driverError}</p> : null}

          {driverLoading ? (
            <LoadingSpinner />
          ) : (
            <>
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

              {driverCars.length === 0 ? (
                <p className="market-empty market-empty-lg">{t('marketplace.emptyDriver')}</p>
              ) : filteredDriverCars.length === 0 ? (
                <p className="market-empty muted">{t('marketplace.filteredEmpty')}</p>
              ) : (
                <div className="market-catalog-list">
                  {filteredDriverCars.map((car) => {
                    const title = [car.model || t('marketplace.car'), car.year != null ? String(car.year) : '']
                      .filter(Boolean)
                      .join(' ')
                    const photo = car.marketplace_photo_url ? String(car.marketplace_photo_url).trim() : ''
                    const available = String(car.marketplace_status || '') === 'dostepne'
                    const feats = normalizeFeatures(car)
                    const dep = Number(car.deposit_amount ?? 0)
                    return (
                      <article key={car.id} className="market-catalog-card">
                        <div className="market-catalog-photo-wrap">
                          {photo ? (
                            <img src={photo} alt="" className="market-catalog-photo" loading="lazy" />
                          ) : (
                            <div className="market-catalog-photo market-catalog-photo--ph" aria-hidden>
                              <span>🚗</span>
                            </div>
                          )}
                          <span className={`market-status-badge${available ? ' market-status-badge--ok' : ''}`}>
                            {available ? t('marketplace.badgeAvailable') : t('marketplace.badgeTaken')}
                          </span>
                        </div>
                        <div className="market-catalog-body">
                          <h2 className="market-catalog-model">{title}</h2>
                          <p className="market-catalog-price">{formatWeekly(car)}</p>
                          {dep > 0 ? (
                            <p className="market-catalog-deposit muted">
                              {t('marketplace.deposit', { amount: dep.toLocaleString(lc) })}
                            </p>
                          ) : null}
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
                          <button
                            type="button"
                            className="btn btn-huge primary market-catalog-cta"
                            onClick={() => {
                              setInterestCar(car)
                              setOpenContact(true)
                              loadCompany()
                            }}
                          >
                            {t('marketplace.contactCta')}
                          </button>
                        </div>
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
          <p className="market-contact-company">
            <strong>{t('marketplace.contactCompany')}</strong> {company.company_name || '—'}
          </p>
          {mergedPhone ? (
            <a className="market-contact-bigbtn" href={`tel:${mergedPhone.replace(/\s+/g, '')}`}>
              <span aria-hidden>📞</span> {t('marketplace.btnCall')}
              <span className="market-contact-bigbtn-sub">{mergedPhone}</span>
            </a>
          ) : null}
          {mergedTelegram ? (
            <a
              className="market-contact-bigbtn market-contact-bigbtn--tg"
              href={telegramHref(mergedTelegram)}
              target="_blank"
              rel="noreferrer"
            >
              <span aria-hidden>✈️</span> {t('marketplace.btnTelegram')}
              <span className="market-contact-bigbtn-sub">{mergedTelegram}</span>
            </a>
          ) : null}
          {mergedEmail ? (
            <a className="market-contact-bigbtn market-contact-bigbtn--mail" href={`mailto:${mergedEmail}`}>
              <span aria-hidden>📧</span> {t('marketplace.btnEmail')}
              <span className="market-contact-bigbtn-sub">{mergedEmail}</span>
            </a>
          ) : (
            <p className="muted">{t('marketplace.noEmail')}</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-huge ghost market-contact-close"
          onClick={() => {
            setOpenContact(false)
            setInterestCar(null)
          }}
        >
          {t('app.close')}
        </button>
      </Modal>
    </div>
  )
}
