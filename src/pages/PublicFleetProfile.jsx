import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'

export function PublicFleetProfile() {
  const { t } = useTranslation()
  const { ownerId } = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [cars, setCars] = useState([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ownerId) return
      setLoading(true)
      setError('')
      const { data: pubProfile, error: profileErr } = await supabase.rpc('get_public_fleet_profile', {
        p_owner_id: ownerId,
      })
      if (profileErr) {
        if (!cancelled) setError(profileErr.message)
        return
      }
      const { data: listedCars, error: carsErr } = await supabase
        .from('cars')
        .select('id, model, year, weekly_rent_pln, marketplace_photo_url, primary_photo_url, marketplace_listed, driver_id, plate_number')
        .eq('owner_id', ownerId)
        .eq('marketplace_listed', true)
        .is('driver_id', null)
        .order('weekly_rent_pln', { ascending: true })
      if (carsErr) {
        if (!cancelled) setError(carsErr.message)
      } else if (!cancelled) {
        setProfile(pubProfile ?? null)
        setCars(listedCars ?? [])
      }
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ownerId])

  const companyName = String(profile?.company_name ?? '').trim() || t('publicFleet.defaultCompany')
  const initials = companyName.slice(0, 1).toUpperCase() || 'C'
  const callHref = String(profile?.company_phone ?? '').trim()
  const availableCount = cars.length
  const totalCount = Number(profile?.fleet_size ?? 0)

  const hasCars = useMemo(() => cars.length > 0, [cars.length])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <div className="page-simple">
        <LoadingSpinner />
      </div>
    )
  }
  if (error) return <div className="page-simple"><p className="form-error">{error}</p></div>

  return (
    <div className="page-simple public-fleet-page">
      <button type="button" className="btn ghost small public-fleet-share" onClick={() => void copyLink()}>
        🔗 {t('publicFleet.share')}
      </button>
      {copied ? <p className="form-info">{t('publicFleet.linkCopied')}</p> : null}

      <section className="card pad-lg public-fleet-header">
        {String(profile?.company_logo_url ?? '').trim() ? (
          <img src={String(profile.company_logo_url)} alt="" className="public-fleet-logo" />
        ) : (
          <div className="public-fleet-logo public-fleet-logo--ph">{initials}</div>
        )}
        <h1>{companyName}</h1>
        <p className="muted">{t('publicFleet.locationBadge', { city: String(profile?.company_location ?? 'Warszawa') })}</p>
        {String(profile?.company_description ?? '').trim() ? <p>{String(profile.company_description)}</p> : null}
        {callHref ? (
          <a className="btn primary" href={`tel:${callHref.replace(/\s+/g, '')}`}>
            📞 {t('publicFleet.call')}
          </a>
        ) : null}
      </section>

      <section className="card pad-lg">
        <h2>{t('publicFleet.availableCars', { count: availableCount })}</h2>
        {!hasCars ? (
          <p className="muted">{t('publicFleet.empty')}</p>
        ) : (
          <div className="market-catalog-list">
            {cars.map((car) => {
              const photo = String(car.primary_photo_url || car.marketplace_photo_url || '').trim()
              const title = [car.model || t('marketplace.car'), car.year ? String(car.year) : ''].filter(Boolean).join(' ')
              return (
                <article key={car.id} className="market-catalog-card">
                  <div className="market-catalog-photo-wrap">
                    {photo ? (
                      <img src={photo} alt="" className="market-catalog-photo market-catalog-photo--hero" loading="lazy" />
                    ) : (
                      <div className="market-catalog-photo market-catalog-photo--ph" aria-hidden>
                        <span>🚗</span>
                      </div>
                    )}
                  </div>
                  <div className="market-catalog-body">
                    <h3 className="market-catalog-model">{title}</h3>
                    <p className="market-catalog-price">{Number(car.weekly_rent_pln ?? 0).toLocaleString()} zł / {t('marketplace.weekShort')}</p>
                    <p className="muted small">{String(car.plate_number ?? '').trim()}</p>
                    <Link to={user ? '/marketplace' : '/register?mode=register&role=driver'} className="btn btn-huge primary market-catalog-cta">
                      {t('publicFleet.apply')}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <p className="muted small">
        {t('publicFleet.totalFleet', { count: totalCount })}
      </p>
    </div>
  )
}
