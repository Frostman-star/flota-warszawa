import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { normalizeProfileRole } from '../utils/profileRole'

const STATUS_OPTIONS = ['pending', 'confirmed', 'in_progress', 'done', 'canceled']

export function ServiceCabinet() {
  const { t } = useTranslation()
  const { user, profile, loading } = useAuth()
  const [serviceProfile, setServiceProfile] = useState(null)
  const [services, setServices] = useState([])
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [slotForm, setSlotForm] = useState({ slot_start_at: '', duration_minutes: 60 })
  const [profileForm, setProfileForm] = useState({ service_id: '', display_name: '', contact_phone: '', contact_email: '' })

  const serviceId = serviceProfile?.service_id || null

  const load = async () => {
    if (!user?.id) return
    setError(null)
    try {
      const [{ data: profileRow, error: profileErr }, { data: servicesRows, error: servicesErr }] = await Promise.all([
        supabase.from('service_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('services').select('id,name,city').order('name'),
      ])
      if (profileErr) throw profileErr
      if (servicesErr) throw servicesErr
      setServiceProfile(profileRow || null)
      setServices(servicesRows || [])
      if (!profileRow) return

      const [{ data: slotRows, error: slotErr }, { data: bookingRows, error: bookingErr }] = await Promise.all([
        supabase.from('service_slots').select('*').eq('service_id', profileRow.service_id).order('slot_start_at'),
        supabase
          .from('service_bookings')
          .select('id,status,issue_description,created_at,customer_user_id,customer_car_id,slot_id,service_slots(slot_start_at)')
          .eq('service_id', profileRow.service_id)
          .order('created_at', { ascending: false }),
      ])
      if (slotErr) throw slotErr
      if (bookingErr) throw bookingErr
      setSlots(slotRows || [])
      setBookings(bookingRows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void load()
  }, [user?.id])

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

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId])

  if (!loading && normalizeProfileRole(profile?.role) !== 'service') return <Navigate to="/" replace />

  return (
    <div className="page-pad stack-md">
      <h1>{t('serviceCabinet.title')}</h1>
      {selectedService ? <p className="muted">{selectedService.name} ({selectedService.city})</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!serviceProfile ? (
        <section className="card pad-lg stack-form">
          <h2>{t('serviceCabinet.linkProfileTitle')}</h2>
          <form className="stack-form" onSubmit={onCreateProfile}>
            <label className="field">
              <span className="field-label">{t('serviceCabinet.pickService')}</span>
              <select
                className="input"
                value={profileForm.service_id}
                onChange={(e) => setProfileForm((f) => ({ ...f, service_id: e.target.value }))}
                required
              >
                <option value="">{t('serviceCabinet.pickServicePlaceholder')}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('serviceCabinet.displayName')}</span>
              <input className="input" value={profileForm.display_name} onChange={(e) => setProfileForm((f) => ({ ...f, display_name: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">{t('serviceCabinet.contactPhone')}</span>
              <input className="input" value={profileForm.contact_phone} onChange={(e) => setProfileForm((f) => ({ ...f, contact_phone: e.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">{t('serviceCabinet.contactEmail')}</span>
              <input className="input" type="email" value={profileForm.contact_email} onChange={(e) => setProfileForm((f) => ({ ...f, contact_email: e.target.value }))} />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{t('serviceCabinet.saveProfile')}</button>
          </form>
        </section>
      ) : (
        <>
          <section className="card pad-lg stack-form">
            <h2>{t('serviceCabinet.slotsTitle')}</h2>
            <form className="stack-form" onSubmit={onAddSlot}>
              <label className="field">
                <span className="field-label">{t('serviceCabinet.slotDateTime')}</span>
                <input className="input" type="datetime-local" value={slotForm.slot_start_at} onChange={(e) => setSlotForm((f) => ({ ...f, slot_start_at: e.target.value }))} required />
              </label>
              <label className="field">
                <span className="field-label">{t('serviceCabinet.slotDuration')}</span>
                <input className="input" type="number" min={30} step={30} value={slotForm.duration_minutes} onChange={(e) => setSlotForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} required />
              </label>
              <button className="btn primary" type="submit" disabled={busy}>{t('serviceCabinet.addSlot')}</button>
            </form>
            <div className="stack-sm">
              {slots.map((slot) => (
                <div key={slot.id} className="card pad-sm services-row">
                  <strong>{new Date(slot.slot_start_at).toLocaleString()}</strong>
                  <span className="muted small">{slot.duration_minutes} min</span>
                  <button className="btn ghost small" type="button" onClick={() => onToggleSlot(slot.id, !slot.is_available)} disabled={busy}>
                    {slot.is_available ? t('serviceCabinet.markBusy') : t('serviceCabinet.markFree')}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card pad-lg">
            <h2>{t('serviceCabinet.bookingsTitle')}</h2>
            <div className="stack-sm">
              {bookings.map((booking) => (
                <article key={booking.id} className="card pad-sm stack-xs">
                  <div className="services-row">
                    <strong>{t(`serviceBookingStatus.${booking.status}`)}</strong>
                    <span className="muted small">{new Date(booking.created_at).toLocaleString()}</span>
                  </div>
                  <p>{booking.issue_description}</p>
                  <p className="muted small">
                    {booking.service_slots?.slot_start_at ? new Date(booking.service_slots.slot_start_at).toLocaleString() : t('serviceCabinet.noSlot')}
                  </p>
                  <div className="services-row">
                    {STATUS_OPTIONS.map((st) => (
                      <button key={st} type="button" className="btn ghost small" disabled={busy || st === booking.status} onClick={() => onBookingStatus(booking.id, st)}>
                        {t(`serviceBookingStatus.${st}`)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              {bookings.length === 0 ? <p className="muted">{t('serviceCabinet.emptyBookings')}</p> : null}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
