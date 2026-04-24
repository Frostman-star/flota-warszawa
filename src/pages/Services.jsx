import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useServicesDirectory } from '../hooks/useServicesDirectory'
import { SERVICE_CATEGORIES } from '../utils/serviceCategories'
import { Modal } from '../components/Modal'
import { LoadingSpinner } from '../components/LoadingSpinner'

function mapsHref(service) {
  const url = service.google_maps_url && String(service.google_maps_url).trim()
  if (url) return url
  const q = [service.name, service.address, service.city].filter(Boolean).join(' ')
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

function telHref(phone) {
  const p = String(phone || '').replace(/\s+/g, '')
  if (!p) return null
  return `tel:${p}`
}

export function Services() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [city, setCity] = useState('Warszawa')
  const { services, loading, error, refresh } = useServicesDirectory({ city })
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [rateService, setRateService] = useState(null)
  const [bookService, setBookService] = useState(null)
  const [slotOptions, setSlotOptions] = useState([])
  const [slotLoading, setSlotLoading] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [myBookings, setMyBookings] = useState([])
  const [userCars, setUserCars] = useState([])
  const [bookForm, setBookForm] = useState({ slot_id: '', issue_description: '', customer_car_id: '' })
  const [toast, setToast] = useState(null)

  const cityOptions = useMemo(() => {
    const fromData = new Set(services.map((s) => String(s.city || '').trim()).filter(Boolean))
    fromData.add('Warszawa')
    return Array.from(fromData).sort((a, b) => a.localeCompare(b, 'pl'))
  }, [services])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return services.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (!q) return true
      const hay = [s.name, s.address, s.description, s.category].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [services, category, search])

  useEffect(() => {
    if (!toast) return
    const tmr = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(tmr)
  }, [toast])

  const [addForm, setAddForm] = useState({
    name: '',
    category: SERVICE_CATEGORIES[0],
    address: '',
    city: 'Warszawa',
    phone: '',
    google_maps_url: '',
    description: '',
  })
  const [addSubmitting, setAddSubmitting] = useState(false)

  const resetAddForm = useCallback(() => {
    setAddForm({
      name: '',
      category: SERVICE_CATEGORIES[0],
      address: '',
      city: 'Warszawa',
      phone: '',
      google_maps_url: '',
      description: '',
    })
  }, [])

  const onAddSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id) return
    const name = addForm.name.trim()
    const address = addForm.address.trim()
    if (!name || !address) return
    setAddSubmitting(true)
    try {
      const { error: e1 } = await supabase.from('services').insert({
        name,
        category: addForm.category,
        address,
        city: addForm.city.trim() || 'Warszawa',
        phone: addForm.phone.trim() || null,
        google_maps_url: addForm.google_maps_url.trim() || null,
        description: addForm.description.trim() || null,
        added_by: user.id,
        verified: false,
      })
      if (e1) throw e1
      setAddOpen(false)
      resetAddForm()
      setToast(t('services.successAdded'))
      await refresh()
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : String(err))
    } finally {
      setAddSubmitting(false)
    }
  }

  const [rateVal, setRateVal] = useState(0)
  const [rateComment, setRateComment] = useState('')
  const [rateSubmitting, setRateSubmitting] = useState(false)

  useEffect(() => {
    if (!rateService) {
      setRateVal(0)
      setRateComment('')
      return
    }
    setRateVal(0)
    setRateComment('')
  }, [rateService])

  const onRateSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id || !rateService || rateVal < 1) return
    setRateSubmitting(true)
    try {
      const { error: e1 } = await supabase.from('service_reviews').upsert(
        {
          service_id: rateService.id,
          user_id: user.id,
          rating: rateVal,
          comment: rateComment.trim() || null,
        },
        { onConflict: 'service_id,user_id' }
      )
      if (e1) throw e1
      setRateService(null)
      await refresh()
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : String(err))
    } finally {
      setRateSubmitting(false)
    }
  }

  const loadMyBookings = useCallback(async () => {
    if (!user?.id) {
      setMyBookings([])
      return
    }
    setBookingsLoading(true)
    try {
      const { data, error: e1 } = await supabase
        .from('service_bookings')
        .select('id,status,issue_description,created_at,service_id,services(name),service_slots(slot_start_at)')
        .eq('customer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (e1) throw e1
      setMyBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setBookingsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadMyBookings()
  }, [loadMyBookings])

  useEffect(() => {
    if (!user?.id) {
      setUserCars([])
      return
    }
    let cancelled = false
    const loadCars = async () => {
      try {
        const { data, error: e1 } = await supabase.from('cars').select('id,plate_number').order('plate_number')
        if (e1) throw e1
        if (!cancelled) setUserCars(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
      }
    }
    void loadCars()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const openBookingModal = async (service) => {
    setBookService(service)
    setBookForm({ slot_id: '', issue_description: '', customer_car_id: '' })
    setSlotLoading(true)
    try {
      const { data, error: e1 } = await supabase
        .from('service_slots')
        .select('id,slot_start_at,duration_minutes')
        .eq('service_id', service.id)
        .eq('is_available', true)
        .gte('slot_start_at', new Date().toISOString())
        .order('slot_start_at')
        .limit(100)
      if (e1) throw e1
      setSlotOptions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setSlotOptions([])
    } finally {
      setSlotLoading(false)
    }
  }

  const onBookSubmit = async (e) => {
    e.preventDefault()
    if (!user?.id || !bookService || !bookForm.slot_id || !bookForm.issue_description.trim()) return
    setBookingSubmitting(true)
    try {
      const { error: e1 } = await supabase.from('service_bookings').insert({
        service_id: bookService.id,
        slot_id: bookForm.slot_id,
        customer_user_id: user.id,
        customer_car_id: bookForm.customer_car_id || null,
        issue_description: bookForm.issue_description.trim(),
      })
      if (e1) throw e1
      setBookService(null)
      setToast(t('services.bookingCreated'))
      await Promise.all([loadMyBookings(), refresh()])
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : String(err))
    } finally {
      setBookingSubmitting(false)
    }
  }

  const startDirectChatWithService = async (serviceId) => {
    if (!user?.id || !serviceId) return
    try {
      const { data: serviceUserId, error: e1 } = await supabase.rpc('get_service_chat_user_id', { p_service_id: serviceId })
      if (e1) throw e1
      if (!serviceUserId) {
        setToast(t('chats.serviceChatUnavailable'))
        return
      }
      const { data: threadId, error: e2 } = await supabase.rpc('chat_get_or_create_direct_thread', { p_other_user_id: serviceUserId })
      if (e2) throw e2
      if (threadId) navigate(`/chats/${threadId}`)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="page-pad services-page">
      {toast ? <div className="services-toast" role="status">{toast}</div> : null}

      <header className="services-head">
        <h1 className="services-title">
          {t('services.pageTitle', { city })}
        </h1>
        <label className="services-city-label muted small">
          <span className="sr-only">{t('services.cityFilter')}</span>
          <select
            className="input services-city-select"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label={t('services.cityFilter')}
          >
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="services-pills" role="tablist" aria-label={t('services.categories')}>
        <button
          type="button"
          role="tab"
          className={`chip${category === 'all' ? ' active' : ''}`}
          onClick={() => setCategory('all')}
        >
          {t('services.allCategories')}
        </button>
        {SERVICE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            className={`chip${category === c ? ' active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="services-search-row">
        <input
          type="search"
          className="input services-search"
          placeholder={t('app.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('app.search')}
        />
      </div>
      <section className="card pad-sm stack-sm">
        <h2 className="services-card__title">{t('services.myBookings')}</h2>
        {bookingsLoading ? <p className="muted small">{t('app.loading')}</p> : null}
        {!bookingsLoading && myBookings.length === 0 ? <p className="muted small">{t('services.noBookings')}</p> : null}
        {!bookingsLoading && myBookings.length > 0 ? (
          <div className="stack-sm">
            {myBookings.map((b) => (
              <article key={b.id} className="card pad-sm">
                <p><strong>{b.services?.name || t('services.unknownService')}</strong></p>
                <p className="muted small">{b.service_slots?.slot_start_at ? new Date(b.service_slots.slot_start_at).toLocaleString() : t('services.noSlot')}</p>
                <p className="muted small">{t(`serviceBookingStatus.${b.status}`)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="center-page">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="muted">{error}</p>
      ) : (
        <div className="services-grid">
          {filtered.map((s) => {
            const phone = s.phone && String(s.phone).trim()
            const tel = telHref(phone)
            const avg = s._avgRating
            const rc = s._reviewCount
            return (
              <article key={s.id} className="card services-card">
                <div className="services-card__head">
                  <h2 className="services-card__title">
                    <span className="services-card__cat" aria-hidden>
                      {(String(s.category || '').split(/\s+/)[0] || '').trim()}
                    </span>{' '}
                    <span className="services-card__name">{s.name}</span>
                  </h2>
                  {s.verified ? (
                    <span className="services-verified" title={t('services.verified')}>
                      ✅ {t('services.verified')}
                    </span>
                  ) : null}
                  {s.plan_tier === 'featured' ? (
                    <span className="services-verified" title={t('services.featured')}>
                      ⭐ {t('services.featured')}
                    </span>
                  ) : null}
                </div>
                <p className="services-card__addr muted small">{s.address}</p>
                <p className="services-card__rating">
                  {avg != null && rc > 0 ? (
                    <>
                      ⭐️ {avg} ({t('services.reviewCount', { count: rc })})
                    </>
                  ) : (
                    <span className="muted">{t('services.noReviews')}</span>
                  )}
                </p>
                <div className="services-card__actions">
                  <a
                    className="btn secondary small services-card__btn"
                    href={mapsHref(s)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 {t('services.maps')}
                  </a>
                  {tel ? (
                    <a className="btn secondary small services-card__btn" href={tel}>
                      📞 {t('services.call')}
                    </a>
                  ) : (
                    <button type="button" className="btn ghost small services-card__btn" disabled>
                      📞 {t('services.call')}
                    </button>
                  )}
                </div>
                <div className="services-card__rate-row">
                  <button type="button" className="btn secondary small" onClick={() => void openBookingModal(s)}>
                    {t('services.book')}
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => void startDirectChatWithService(s.id)}>
                    {t('chats.message')}
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setRateService(s)}>
                    {t('services.rate')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <button type="button" className="services-fab" onClick={() => setAddOpen(true)} aria-label={t('services.addService')}>
        ➕
      </button>

      <Modal open={addOpen} title={t('services.addService')} onClose={() => !addSubmitting && setAddOpen(false)}>
        <form className="stack-form" onSubmit={onAddSubmit}>
          <label className="field">
            <span className="field-label">{t('services.fieldName')} *</span>
            <input
              className="input"
              required
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldCategory')} *</span>
            <select
              className="input"
              required
              value={addForm.category}
              onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldAddress')} *</span>
            <input
              className="input"
              required
              value={addForm.address}
              onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldCity')}</span>
            <input
              className="input"
              value={addForm.city}
              onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldPhone')}</span>
            <input
              className="input"
              type="tel"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldMapsUrl')}</span>
            <input
              className="input"
              type="url"
              value={addForm.google_maps_url}
              onChange={(e) => setAddForm((f) => ({ ...f, google_maps_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label className="field">
            <span className="field-label">{t('services.fieldDescription')}</span>
            <textarea
              className="input services-textarea"
              rows={3}
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('services.descriptionPlaceholder')}
            />
          </label>
          <button type="submit" className="btn primary" disabled={addSubmitting}>
            {addSubmitting ? t('login.processing') : t('services.submitAdd')}
          </button>
        </form>
      </Modal>

      <Modal open={Boolean(rateService)} title={t('services.rateTitle')} onClose={() => !rateSubmitting && setRateService(null)}>
        {rateService ? (
          <form className="stack-form" onSubmit={onRateSubmit}>
            <p className="muted small">{rateService.name}</p>
            <div className="services-stars" aria-label={t('services.rate')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`services-star${rateVal >= n ? ' services-star--on' : ''}`}
                  onClick={() => setRateVal(n)}
                  aria-pressed={rateVal >= n}
                >
                  ★
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">{t('services.commentOptional')}</span>
              <textarea
                className="input services-textarea"
                rows={2}
                value={rateComment}
                onChange={(e) => setRateComment(e.target.value)}
              />
            </label>
            <button type="submit" className="btn primary" disabled={rateSubmitting || rateVal < 1}>
              {rateSubmitting ? t('login.processing') : t('services.submitRate')}
            </button>
          </form>
        ) : null}
      </Modal>
      <Modal open={Boolean(bookService)} title={t('services.bookTitle')} onClose={() => !bookingSubmitting && setBookService(null)}>
        {bookService ? (
          <form className="stack-form" onSubmit={onBookSubmit}>
            <p className="muted small">{bookService.name}</p>
            <label className="field">
              <span className="field-label">{t('services.pickSlot')}</span>
              <select
                className="input"
                required
                value={bookForm.slot_id}
                onChange={(e) => setBookForm((f) => ({ ...f, slot_id: e.target.value }))}
                disabled={slotLoading}
              >
                <option value="">{slotLoading ? t('app.loading') : t('services.pickSlotPlaceholder')}</option>
                {slotOptions.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {new Date(slot.slot_start_at).toLocaleString()} ({slot.duration_minutes} min)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('services.pickCarOptional')}</span>
              <select className="input" value={bookForm.customer_car_id} onChange={(e) => setBookForm((f) => ({ ...f, customer_car_id: e.target.value }))}>
                <option value="">{t('services.noCarSelected')}</option>
                {userCars.map((car) => (
                  <option key={car.id} value={car.id}>{car.plate_number}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('services.issueDescription')}</span>
              <textarea
                className="input services-textarea"
                rows={3}
                required
                value={bookForm.issue_description}
                onChange={(e) => setBookForm((f) => ({ ...f, issue_description: e.target.value }))}
                placeholder={t('services.issuePlaceholder')}
              />
            </label>
            <button type="submit" className="btn primary" disabled={bookingSubmitting || slotLoading || slotOptions.length === 0}>
              {bookingSubmitting ? t('login.processing') : t('services.submitBooking')}
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
