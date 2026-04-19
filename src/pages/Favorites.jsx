import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { localeTag } from '../utils/localeTag'

export function Favorites() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { user, isDriver } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cars, setCars] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isDriver || !user?.id) {
      setCars([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data: favs, error: favErr } = await supabase
      .from('driver_favorites')
      .select('vehicle_id')
      .eq('driver_id', user.id)
    if (favErr) {
      setError(favErr.message)
      setLoading(false)
      return
    }
    const ids = (favs ?? []).map((f) => f.vehicle_id)
    if (ids.length === 0) {
      setCars([])
      setLoading(false)
      return
    }
    const { data, error: carsErr } = await supabase
      .from('cars')
      .select('id, model, year, weekly_rent_pln, marketplace_photo_url, primary_photo_url, plate_number, marketplace_listed, driver_id')
      .in('id', ids)
      .eq('marketplace_listed', true)
      .is('driver_id', null)
    if (carsErr) setError(carsErr.message)
    else setCars(data ?? [])
    setLoading(false)
  }, [isDriver, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  if (!isDriver) return <Navigate to="/panel" replace />

  return (
    <div className="page-simple marketplace-page market-catalog-page">
      <p className="muted small">
        <Link to="/marketplace" className="link">
          ← {t('nav.marketplace')}
        </Link>
      </p>
      <header className="market-catalog-header">
        <div className="market-catalog-title-row">
          <h1 className="market-catalog-title">❤️ {t('favorites.title')}</h1>
          <span className="market-catalog-count">{cars.length}</span>
        </div>
      </header>
      <p className="muted small">
        <button type="button" className="link link-button" onClick={() => void load()}>
          {t('app.tryAgain')}
        </button>
      </p>
      {loading ? <LoadingSpinner /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && cars.length === 0 ? <p className="market-empty market-empty-lg">{t('favorites.empty')}</p> : null}
      {!loading && cars.length > 0 ? (
        <div className="market-catalog-list">
          {cars.map((car) => {
            const photo = String(car.primary_photo_url || car.marketplace_photo_url || '').trim()
            const title = [car.model || t('marketplace.car'), car.year != null ? String(car.year) : ''].filter(Boolean).join(' ')
            const weekly = Math.round(Number(car.weekly_rent_pln ?? 0))
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
                  <h2 className="market-catalog-model">{title}</h2>
                  <p className="market-catalog-price">
                    {weekly.toLocaleString(lc)} zł / {t('marketplace.weekShort')}
                  </p>
                  <p className="muted small">{String(car.plate_number ?? '').trim()}</p>
                  <Link to="/marketplace" className="btn btn-huge primary market-catalog-cta">
                    {t('marketplace.applyCta')}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
