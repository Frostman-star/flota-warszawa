import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardList,
  Home,
  LifeBuoy,
  MessageCircleMore,
  Settings,
  Star,
  User,
  Users,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { normalizeProfileRole } from '../utils/profileRole'
import { LANG_OPTIONS } from '../i18n'

const STATUS_OPTIONS = ['pending', 'confirmed', 'in_progress', 'done', 'canceled']

function byStatusWeight(status) {
  if (status === 'pending') return 0
  if (status === 'confirmed') return 1
  if (status === 'in_progress') return 2
  if (status === 'done') return 3
  return 4
}

function statusClass(status) {
  if (status === 'pending') return 'service-status service-status--pending'
  if (status === 'confirmed') return 'service-status service-status--confirmed'
  if (status === 'in_progress') return 'service-status service-status--progress'
  if (status === 'done') return 'service-status service-status--done'
  return 'service-status service-status--canceled'
}

export function ServiceCabinet() {
  const { t, i18n } = useTranslation()
  const { user, profile, loading, isAdmin } = useAuth()
  const [serviceProfile, setServiceProfile] = useState(null)
  const [services, setServices] = useState([])
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [reviews, setReviews] = useState([])
  const [featuredRequests, setFeaturedRequests] = useState([])
  const [adminServiceId, setAdminServiceId] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [activeSection, setActiveSection] = useState('service-home')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [slotForm, setSlotForm] = useState({ slot_start_at: '', duration_minutes: 60 })
  const [profileForm, setProfileForm] = useState({ service_id: '', display_name: '', contact_phone: '', contact_email: '' })

  const roleNorm = normalizeProfileRole(profile?.role)
  const isService = roleNorm === 'service'
  const serviceId = isAdmin ? adminServiceId || null : serviceProfile?.service_id || null

  const load = async () => {
    if (!user?.id) return
    setError(null)
    try {
      const [{ data: profileRow, error: profileErr }, { data: servicesRows, error: servicesErr }] = await Promise.all([
        supabase.from('service_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('services').select('id,name,city,plan_tier,featured_until').order('name'),
      ])
      if (profileErr) throw profileErr
      if (servicesErr) throw servicesErr
      setServiceProfile(profileRow || null)
      setServices(servicesRows || [])
      if (!isAdmin && !profileRow) return

      if (isAdmin && !adminServiceId && servicesRows?.[0]?.id) {
        setAdminServiceId(servicesRows[0].id)
      }

      const effectiveServiceId = isAdmin ? (adminServiceId || servicesRows?.[0]?.id || null) : profileRow.service_id
      if (!effectiveServiceId) return

      const [{ data: slotRows, error: slotErr }, { data: bookingRows, error: bookingErr }, { data: reviewRows, error: reviewErr }] = await Promise.all([
        supabase.from('service_slots').select('*').eq('service_id', effectiveServiceId).order('slot_start_at'),
        supabase
          .from('service_bookings')
          .select('id,status,issue_description,created_at,customer_user_id,customer_car_id,slot_id,service_slots(slot_start_at)')
          .eq('service_id', effectiveServiceId)
          .order('created_at', { ascending: false }),
        supabase.from('service_reviews').select('id,rating,comment,created_at').eq('service_id', effectiveServiceId).order('created_at', { ascending: false }).limit(12),
      ])
      if (slotErr) throw slotErr
      if (bookingErr) throw bookingErr
      if (reviewErr) throw reviewErr
      setSlots(slotRows || [])
      setBookings(bookingRows || [])
      setReviews(reviewRows || [])

      const { data: featuredRows, error: featuredErr } = await supabase
        .from('service_featured_requests')
        .select('id,status,created_at,note,service_id')
        .eq('service_id', effectiveServiceId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (featuredErr) throw featuredErr
      setFeaturedRequests(featuredRows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
  }, [user?.id, isAdmin, adminServiceId])

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash) setActiveSection(hash)
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const onCreateProfile = async (e) => {
    e.preventDefault()
    if (!user?.id || !profileForm.service_id) return
    setBusy(true)
    try {
      const payload = {
        id: user.id,
        service_id: profileForm.service_id,
        display_name: profileForm.display_name.trim() || profile?.full_name || '',
        contact_phone: profileForm.contact_phone.trim() || null,
        contact_email: profileForm.contact_email.trim() || profile?.email || null,
      }
      const { error: upsertErr } = await supabase.from('service_profiles').upsert(payload)
      if (upsertErr) throw upsertErr
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onAddSlot = async (e) => {
    e.preventDefault()
    if (!user?.id || !serviceId || !slotForm.slot_start_at) return
    setBusy(true)
    try {
      const { error: insertErr } = await supabase.from('service_slots').insert({
        service_id: serviceId,
        slot_start_at: new Date(slotForm.slot_start_at).toISOString(),
        duration_minutes: Number(slotForm.duration_minutes) || 60,
        is_available: true,
        created_by: user.id,
      })
      if (insertErr) throw insertErr
      setSlotForm({ slot_start_at: '', duration_minutes: 60 })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onRequestFeatured = async (e) => {
    e.preventDefault()
    if (!user?.id || !serviceId || !isService) return
    setBusy(true)
    try {
      const { error: insErr } = await supabase.from('service_featured_requests').insert({
        service_id: serviceId,
        requested_by: user.id,
        note: requestNote.trim() || null,
      })
      if (insErr) throw insErr
      setRequestNote('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onAdminPlanChange = async (nextTier) => {
    if (!isAdmin || !serviceId) return
    setBusy(true)
    try {
      const { error: updErr } = await supabase.from('services').update({ plan_tier: nextTier, featured_until: null }).eq('id', serviceId)
      if (updErr) throw updErr
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onToggleSlot = async (slotId, nextAvailable) => {
    setBusy(true)
    try {
      const { error: updErr } = await supabase.from('service_slots').update({ is_available: nextAvailable }).eq('id', slotId)
      if (updErr) throw updErr
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onBookingStatus = async (bookingId, status) => {
    setBusy(true)
    try {
      const { error: updErr } = await supabase.from('service_bookings').update({ status }).eq('id', bookingId)
      if (updErr) throw updErr
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const startDirectChat = async (otherUserId) => {
    if (!otherUserId) return
    try {
      const { data: threadId, error: e1 } = await supabase.rpc('chat_get_or_create_direct_thread', { p_other_user_id: otherUserId })
      if (e1) throw e1
      if (threadId) window.location.assign(`/chats/${threadId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId])
  const langCode = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0]
  const slotsByDay = useMemo(() => {
    const grouped = new Map()
    for (const slot of slots) {
      const d = new Date(slot.slot_start_at)
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
      const arr = grouped.get(key) || []
      arr.push(slot)
      grouped.set(key, arr)
    }
    return [...grouped.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0])).slice(0, 6)
  }, [slots])
  const pendingCount = bookings.filter((b) => b.status === 'pending').length
  const todayCount = bookings.filter((b) => {
    const d = new Date(b.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length
  const positiveRate = reviews.length ? Math.round((reviews.filter((r) => Number(r.rating) >= 4).length / reviews.length) * 100) : 0
  const avgRating = reviews.length ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length) * 10) / 10 : 0
  const sortedBookings = [...bookings].sort((a, b) => byStatusWeight(a.status) - byStatusWeight(b.status))
  const weeklySeries = useMemo(() => {
    const now = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      days.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }), count: 0 })
    }
    const map = new Map(days.map((d) => [d.key, d]))
    for (const b of bookings) {
      const key = new Date(b.created_at).toDateString()
      const row = map.get(key)
      if (row) row.count += 1
    }
    const max = Math.max(1, ...days.map((d) => d.count))
    return { points: days, max }
  }, [bookings])
  const sidebarItems = [
    { key: 'home', target: 'service-home', icon: Home, label: t('serviceCabinet.menu.home') },
    { key: 'bookings', target: 'service-bookings', icon: ClipboardList, label: t('serviceCabinet.menu.bookings'), badge: pendingCount > 0 ? pendingCount : null },
    { key: 'slots', target: 'service-slots', icon: CalendarDays, label: t('serviceCabinet.menu.slots') },
    { key: 'clients', target: 'service-bookings', icon: Users, label: t('serviceCabinet.menu.clients') },
    { key: 'cars', target: 'service-slots', icon: Car, label: t('serviceCabinet.menu.clientCars') },
    { key: 'pricing', target: 'service-pricing', icon: Wrench, label: t('serviceCabinet.menu.pricing') },
    { key: 'stats', target: 'service-stats', icon: BarChart3, label: t('serviceCabinet.menu.stats') },
    { key: 'reviews', target: 'service-rating', icon: Star, label: t('serviceCabinet.menu.reviews') },
    { key: 'settings', target: 'service-pricing', icon: Settings, label: t('serviceCabinet.menu.settings') },
    { key: 'profile', target: 'service-profile', icon: User, label: t('serviceCabinet.menu.profile') },
  ]

  if (!loading && !isService && !isAdmin) return <Navigate to="/" replace />

  if (!isAdmin && !serviceProfile) {
    return (
      <div className="page-pad stack-md">
        <h1>{t('serviceCabinet.title')}</h1>
        {error ? <p className="form-error">{error}</p> : null}
        <section className="card pad-lg stack-form">
          <h2>{t('serviceCabinet.linkProfileTitle')}</h2>
          <form className="stack-form" onSubmit={onCreateProfile}>
            <label className="field">
              <span className="field-label">{t('serviceCabinet.pickService')}</span>
              <select className="input" value={profileForm.service_id} onChange={(e) => setProfileForm((f) => ({ ...f, service_id: e.target.value }))} required>
                <option value="">{t('serviceCabinet.pickServicePlaceholder')}</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
              </select>
            </label>
            <label className="field"><span className="field-label">{t('serviceCabinet.displayName')}</span><input className="input" value={profileForm.display_name} onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))} /></label>
            <label className="field"><span className="field-label">{t('serviceCabinet.contactPhone')}</span><input className="input" value={profileForm.contact_phone} onChange={(e) => setProfileForm((f) => ({ ...f, contact_phone: e.target.value }))} /></label>
            <label className="field"><span className="field-label">{t('serviceCabinet.contactEmail')}</span><input className="input" type="email" value={profileForm.contact_email} onChange={(e) => setProfileForm((f) => ({ ...f, contact_email: e.target.value }))} /></label>
            <button className="btn primary" type="submit" disabled={busy}>{t('serviceCabinet.saveProfile')}</button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="service-dashboard">
      <aside className="service-dashboard-sidebar card">
        <div className="service-dashboard-brand">
          <Wrench size={16} />
          <strong>{selectedService?.name || t('serviceCabinet.title')}</strong>
        </div>
        <nav className="service-dashboard-nav">
          {sidebarItems.map((item, idx) => (
            <a key={item.key} className={activeSection === item.target || (idx === 0 && !activeSection) ? 'is-active' : ''} href={`#${item.target}`}>
              <span className="service-dashboard-nav__icon" aria-hidden>
                <item.icon size={15} />
              </span>
              <span>{item.label}</span>
              {item.badge ? <span className="service-dashboard-nav__badge">{item.badge > 9 ? '9+' : item.badge}</span> : null}
            </a>
          ))}
          <Link to="/chats">
            <span className="service-dashboard-nav__icon" aria-hidden>
              <MessageCircleMore size={15} />
            </span>
            <span>{t('nav.chats')}</span>
          </Link>
        </nav>
        <div className="service-dashboard-help card">
          <p className="service-dashboard-help__title">{t('serviceCabinet.helpTitle')}</p>
          <p className="muted small">{t('serviceCabinet.helpLead')}</p>
          <Link className="btn ghost small" to="/chats">
            <LifeBuoy size={14} /> {t('serviceCabinet.contactSupport')}
          </Link>
        </div>
      </aside>

      <main className="service-dashboard-main">
        <section className="service-dashboard-topbar card">
          <div>
            <p className="muted tiny">{t('serviceCabinet.greeting')}</p>
            <strong>{selectedService?.name || t('serviceCabinet.title')}</strong>
          </div>
          <div className="service-dashboard-topbar__actions">
            <div className="lang-switch">
              {LANG_OPTIONS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-flag${langCode === l.code ? ' active' : ''}`}
                  onClick={() => i18n.changeLanguage(l.code)}
                >
                  {l.flag}
                </button>
              ))}
            </div>
            <button type="button" className="service-topbar-alert btn ghost small" aria-label="Notifications">
              <Bell size={14} />
            </button>
            <div className="service-dashboard-account">
              <div className="service-dashboard-account__meta">
                <strong>{selectedService?.name || t('serviceCabinet.title')}</strong>
                <span className="muted tiny">{selectedService?.city || ''}</span>
              </div>
              <ChevronDown size={14} />
            </div>
            <div className="service-dashboard-profile-chip">
              <span>{(profile?.full_name || profile?.email || 'Service').slice(0, 2).toUpperCase()}</span>
            </div>
          </div>
        </section>
        {isAdmin ? (
          <label className="field">
            <span className="field-label">{t('serviceCabinet.adminPickService')}</span>
            <select className="input" value={adminServiceId} onChange={(e) => setAdminServiceId(e.target.value)}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
            </select>
          </label>
        ) : null}
        <section id="service-home" className="service-dashboard-hero card">
          <div className="service-dashboard-hero__copy">
            <p className="muted small">{selectedService?.city}</p>
            <h1>
              {t('serviceCabinet.title')} <span>Cario</span>
            </h1>
            <p className="muted">{selectedService?.plan_tier === 'featured' ? t('serviceCabinet.planFeatured') : t('serviceCabinet.planFree')}</p>
          </div>
          <div className="service-kpi-grid">
            <article className="service-kpi card"><CalendarDays size={16} /><strong>{pendingCount}</strong><span>{t('serviceCabinet.newRequestsLabel')}</span></article>
            <article className="service-kpi card"><BarChart3 size={16} /><strong>{todayCount}</strong><span>{t('serviceCabinet.todayLabel')}</span></article>
            <article className="service-kpi card"><Star size={16} /><strong>{positiveRate}%</strong><span>{t('serviceCabinet.positiveShare')}</span></article>
          </div>
          <div className="service-dashboard-hero__visual" aria-hidden />
        </section>

        <section id="service-slots" className="card pad-lg">
          <div className="services-row service-section-head">
            <h2>{t('serviceCabinet.slotsTitle')}</h2>
            <form className="services-row" onSubmit={onAddSlot}>
              <input className="input" type="datetime-local" value={slotForm.slot_start_at} onChange={(e) => setSlotForm((f) => ({ ...f, slot_start_at: e.target.value }))} required />
              <input className="input" type="number" min={30} step={30} value={slotForm.duration_minutes} onChange={(e) => setSlotForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} required />
              <button className="btn primary" type="submit" disabled={busy}>{t('serviceCabinet.addSlot')}</button>
            </form>
          </div>
          <div className="service-slots-days">
            {slotsByDay.map(([day, daySlots]) => (
              <div key={day} className="service-slots-day card pad-sm">
                <strong>{new Date(day).toLocaleDateString()}</strong>
                <div className="stack-xs">
                  {daySlots.map((slot) => (
                    <button key={slot.id} type="button" className={`btn small ${slot.is_available ? 'ghost' : 'secondary'}`} onClick={() => onToggleSlot(slot.id, !slot.is_available)} disabled={busy}>
                      {new Date(slot.slot_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({slot.duration_minutes}m)
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="service-bookings" className="card pad-lg">
          <div className="services-row service-section-head">
            <h2>{t('serviceCabinet.bookingsTitle')}</h2>
            <Link to="/chats" className="btn ghost small">{t('chats.title')}</Link>
          </div>
          <div className="stack-sm">
            {sortedBookings.map((booking) => (
              <article key={booking.id} className="card pad-sm">
                <div className="services-row">
                  <strong>#{booking.id.slice(0, 6)}</strong>
                  <span className={statusClass(booking.status)}>{t(`serviceBookingStatus.${booking.status}`)}</span>
                </div>
                <p>{booking.issue_description}</p>
                <p className="muted small">{booking.service_slots?.slot_start_at ? new Date(booking.service_slots.slot_start_at).toLocaleString() : t('serviceCabinet.noSlot')}</p>
                <div className="services-row">
                  {STATUS_OPTIONS.map((st) => (
                    <button key={st} type="button" className="btn ghost small" disabled={busy || st === booking.status} onClick={() => onBookingStatus(booking.id, st)}>
                      {t(`serviceBookingStatus.${st}`)}
                    </button>
                  ))}
                  {booking.customer_user_id ? (
                    <button type="button" className="btn ghost small" onClick={() => void startDirectChat(booking.customer_user_id)}>
                      <MessageCircleMore size={14} /> {t('chats.message')}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {sortedBookings.length === 0 ? <p className="muted">{t('serviceCabinet.emptyBookings')}</p> : null}
          </div>
        </section>

        <section id="service-rating" className="service-dashboard-bottom">
          <article className="card pad-lg">
            <h2>{t('serviceCabinet.planTitle')}</h2>
            <p className="muted">{selectedService?.plan_tier === 'featured' ? t('serviceCabinet.planFeatured') : t('serviceCabinet.planFree')}</p>
            {isService ? (
              <form className="stack-form" onSubmit={onRequestFeatured}>
                <textarea className="input services-textarea" rows={2} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder={t('serviceCabinet.featuredRequestNote')} />
                <button type="submit" className="btn secondary" disabled={busy}>{t('serviceCabinet.requestFeatured')}</button>
              </form>
            ) : null}
            {isAdmin ? (
              <div className="services-row">
                <button type="button" className="btn ghost small" disabled={busy || selectedService?.plan_tier === 'free'} onClick={() => onAdminPlanChange('free')}>{t('serviceCabinet.setPlanFree')}</button>
                <button type="button" className="btn ghost small" disabled={busy || selectedService?.plan_tier === 'featured'} onClick={() => onAdminPlanChange('featured')}>{t('serviceCabinet.setPlanFeatured')}</button>
              </div>
            ) : null}
            {featuredRequests.map((req) => (
              <p key={req.id} className="muted small">{new Date(req.created_at).toLocaleString()} - {t(`serviceCabinet.requestStatus.${req.status}`)}</p>
            ))}
          </article>
          <article className="card pad-lg" id="service-profile">
            <h2>{t('serviceCabinet.ratingTitle')}</h2>
            <p className="service-rating-main">{avgRating.toFixed(1)} / 5</p>
            <p className="muted small">{t('serviceCabinet.reviewsCount', { count: reviews.length })}</p>
            <div className="stack-xs">
              {reviews.slice(0, 4).map((r) => (
                <p key={r.id} className="muted small">⭐ {Number(r.rating).toFixed(1)} · {r.comment || '-'}</p>
              ))}
            </div>
          </article>
        </section>

        <section id="service-stats" className="service-dashboard-bottom">
          <article className="card pad-lg">
            <h2>{t('serviceCabinet.statsTitle')}</h2>
            <div className="service-mini-chart">
              {weeklySeries.points.map((p) => (
                <div key={p.key} className="service-mini-chart__col">
                  <div className="service-mini-chart__bar" style={{ height: `${(p.count / weeklySeries.max) * 100}%` }} />
                  <span className="muted tiny">{p.label}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="card pad-lg" id="service-pricing">
            <h2>{t('serviceCabinet.planTitle')}</h2>
            <p className="muted">{selectedService?.plan_tier === 'featured' ? t('serviceCabinet.planFeatured') : t('serviceCabinet.planFree')}</p>
            <div className="services-row" id="service-settings">
              <Link className="btn ghost small" to="/serwisy">{t('serviceCabinet.openDirectory')}</Link>
              <Link className="btn secondary small" to="/chats">{t('chats.open')}</Link>
            </div>
          </article>
        </section>

        {error ? <p className="form-error">{error}</p> : null}
      </main>
    </div>
  )
}
