import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Modal } from '../components/Modal'
import { localeTag } from '../utils/localeTag'

export function Marketplace() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { isAdmin } = useAuth()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState('')
  const [openContact, setOpenContact] = useState(false)
  const [interestCar, setInterestCar] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: c } = await supabase.from('company_settings').select('contact_email').eq('id', 1).maybeSingle()
    setContact(c?.contact_email ?? '')
    const { data, error } = await supabase.from('cars').select('id, plate_number, model, year, weekly_rent_pln').eq('show_in_marketplace', true).eq('marketplace_status', 'dostepne').order('weekly_rent_pln', { ascending: true })
    if (!error) setCars(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="page-simple">
      <p className="muted small"><Link to={isAdmin ? '/panel' : '/'} className="link">{isAdmin ? `← ${t('app.panel')}` : `← ${t('app.home')}`}</Link></p>
      <h1>{t('marketplace.title')}</h1>
      <p className="muted lead">{t('marketplace.lead')}</p>
      {loading ? <LoadingSpinner /> : (
        <div className="market-grid">
          {cars.map((car) => (
            <article key={car.id} className="market-card">
              <div className="market-photo" aria-hidden>🚕</div>
              <h2>{car.model || t('marketplace.car')}</h2>
              <p className="muted">{car.year ?? '—'}</p>
              <p className="market-price">{Number(car.weekly_rent_pln ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}<span className="muted small"> {t('marketplace.week')}</span></p>
              <p className="muted">📍 {t('marketplace.location')}</p>
              <button type="button" className="btn btn-huge primary" onClick={() => { setInterestCar(car); setOpenContact(true) }}>{t('marketplace.interest')}</button>
            </article>
          ))}
        </div>
      )}

      <Modal open={openContact} title={interestCar ? t('marketplace.contact', { plate: interestCar.plate_number }) : t('marketplace.title')} onClose={() => { setOpenContact(false); setInterestCar(null) }}>
        <p className="muted">{contact ? <>{t('marketplace.writeTo')} <strong>{contact}</strong></> : t('marketplace.noEmail')}</p>
        <button type="button" className="btn btn-huge primary" onClick={() => { setOpenContact(false); setInterestCar(null) }}>
          {t('app.ok')}
        </button>
      </Modal>
    </div>
  )
}
