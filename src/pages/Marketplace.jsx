import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { Modal } from '../components/Modal'

export function Marketplace() {
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState('')
  const [openContact, setOpenContact] = useState(false)
  const [interestCar, setInterestCar] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: c } = await supabase.from('company_settings').select('contact_email').eq('id', 1).maybeSingle()
    setContact(c?.contact_email ?? '')

    const { data, error } = await supabase
      .from('cars')
      .select('id, plate_number, model, year, weekly_rent_pln')
      .eq('show_in_marketplace', true)
      .eq('marketplace_status', 'dostepne')
      .order('weekly_rent_pln', { ascending: true })

    if (!error) setCars(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page-simple">
      <p className="muted small">
        <Link to="/panel" className="link">
          ← Panel
        </Link>
      </p>
      <h1>Marketplace</h1>
      <p className="muted lead">Auta dostępne do wynajmu (wersja podstawowa).</p>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="market-grid">
          {cars.map((car) => (
            <article key={car.id} className="market-card">
              <div className="market-photo" aria-hidden>
                🚕
              </div>
              <h2>{car.model || 'Auto'}</h2>
              <p className="muted">{car.year ?? '—'}</p>
              <p className="market-price">
                {Number(car.weekly_rent_pln ?? 0).toLocaleString('pl-PL', {
                  style: 'currency',
                  currency: 'PLN',
                })}
                <span className="muted small"> / tydzień</span>
              </p>
              <p className="muted">📍 Warszawa</p>
              <button
                type="button"
                className="btn btn-huge primary"
                onClick={() => {
                  setInterestCar(car)
                  setOpenContact(true)
                }}
              >
                Jestem zainteresowany
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={openContact}
        title={interestCar ? `Kontakt — ${interestCar.plate_number}` : 'Kontakt'}
        onClose={() => {
          setOpenContact(false)
          setInterestCar(null)
        }}
      >
        <p className="muted">
          {contact ? (
            <>
              Napisz na: <strong>{contact}</strong>
            </>
          ) : (
            'Administrator nie ustawił jeszcze adresu e-mail kontaktowego (Ustawienia → e-mail kontaktowy).'
          )}
        </p>
        <button
          type="button"
          className="btn btn-huge primary"
          onClick={() => {
            setOpenContact(false)
            setInterestCar(null)
          }}
        >
          OK
        </button>
      </Modal>
    </div>
  )
}
