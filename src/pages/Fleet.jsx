import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { carPath } from '../lib/carPaths'
import { CarFormModal } from '../components/CarFormModal'
import { FleetDocDots } from '../components/FleetDocDots'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useDrivers } from '../hooks/useDrivers'
import { useAuth } from '../context/AuthContext'
import { localeTag } from '../utils/localeTag'

/** @typedef {{ pendingApps: number; pendingEmployment: number; chatAttention: number; chatFirstAppId: string | null }} CarAttention */

export function Fleet() {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const { cars, loading, error, refresh } = useOutletContext()
  const { isAdmin, user } = useAuth()
  const { drivers } = useDrivers(isAdmin, user?.id)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  /** @type {[Record<string, CarAttention>, import('react').Dispatch<import('react').SetStateAction<Record<string, CarAttention>>>]} */
  const [attentionByCarId, setAttentionByCarId] = useState({})

  useEffect(() => {
    const ids = (cars ?? []).map((c) => c.id).filter(Boolean)
    if (!ids.length || !user?.id) {
      setAttentionByCarId({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error: rpcErr } = await supabase.rpc('owner_fleet_car_attention_counts', { p_car_ids: ids })
      if (cancelled) return
      if (rpcErr) {
        console.error(rpcErr)
        const { data: rows, error: appErr } = await supabase
          .from('driver_applications')
          .select('car_id')
          .eq('status', 'pending')
          .eq('owner_id', user.id)
          .in('car_id', ids)
        if (cancelled) return
        if (appErr) {
          console.error(appErr)
          setAttentionByCarId({})
          return
        }
        const m = /** @type {Record<string, CarAttention>} */ ({})
        for (const id of ids) {
          m[String(id)] = { pendingApps: 0, pendingEmployment: 0, chatAttention: 0, chatFirstAppId: null }
        }
        for (const row of rows ?? []) {
          const id = String(row.car_id)
          if (!m[id]) m[id] = { pendingApps: 0, pendingEmployment: 0, chatAttention: 0, chatFirstAppId: null }
          m[id].pendingApps += 1
        }
        setAttentionByCarId(m)
        return
      }
      const m = /** @type {Record<string, CarAttention>} */ ({})
      for (const id of ids) {
        m[String(id)] = { pendingApps: 0, pendingEmployment: 0, chatAttention: 0, chatFirstAppId: null }
      }
      for (const row of data ?? []) {
        const id = String(row.car_id)
        m[id] = {
          pendingApps: Number(row.pending_apps ?? 0),
          pendingEmployment: Number(row.pending_employment ?? 0),
          chatAttention: Number(row.chat_attention ?? 0),
          chatFirstAppId: row.chat_first_app_id != null ? String(row.chat_first_app_id) : null,
        }
      }
      setAttentionByCarId(m)
    })()
    return () => {
      cancelled = true
    }
  }, [cars, user?.id])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = [...cars]
    if (s) {
      out = out.filter((c) => String(c.plate_number ?? '').toLowerCase().includes(s) || String(c.driver_name ?? '').toLowerCase().includes(s))
    }
    out.sort((a, b) => String(a.plate_number).localeCompare(String(b.plate_number), 'pl'))
    return out
  }, [cars, q])

  async function handleDelete(car) {
    if (!window.confirm(t('fleet.confirmDelete', { plate: car.plate_number }))) return
    if (!user?.id) return
    const { error: delErr } = await supabase.from('cars').delete().eq('id', car.id).eq('owner_id', user.id)
    if (delErr) return alert(delErr.message)
    refresh?.()
  }

  if (loading) return <div className="page-simple"><LoadingSpinner /></div>
  if (error) return <div className="page-simple"><p className="form-error">{error}</p><button type="button" className="btn btn-huge primary" onClick={() => refresh?.()}>{t('app.refresh')}</button></div>

  return (
    <div className="page-simple">
      <p className="muted small"><Link to="/panel" className="link">← {t('app.panel')}</Link></p>
      <h1>{t('fleet.title')}</h1>
      <p className="muted small fleet-attention-legend">{t('fleet.attentionLegend')}</p>
      <input className="input input-xl fleet-search-simple" type="search" placeholder={t('fleet.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('app.search')} />
      <div className="car-card-grid">
        {list.map((car) => {
          const cid = String(car.id)
          const tilePhoto = String(car.primary_photo_url || car.marketplace_photo_url || '').trim()
          const a = attentionByCarId[cid] ?? {
            pendingApps: 0,
            pendingEmployment: 0,
            chatAttention: 0,
            chatFirstAppId: null,
          }
          const chatHref =
            a.chatAttention > 0
              ? a.chatAttention === 1 && a.chatFirstAppId
                ? `/rozmowa-wniosek/${a.chatFirstAppId}`
                : `/wnioski?carId=${encodeURIComponent(cid)}&focus=chat`
              : null
          return (
            <article key={car.id} className="car-tile">
              <div className="fleet-attention-flags" aria-label={t('fleet.attentionFlagsAria')}>
                {a.pendingApps > 0 ? (
                  <Link
                    to={`/wnioski?carId=${encodeURIComponent(cid)}`}
                    className="fleet-attn-flag fleet-attn-flag--apps"
                    aria-label={t('fleet.attentionAppsBadge', { count: a.pendingApps })}
                  >
                    <span className="fleet-attn-flag-emoji" aria-hidden>
                      📋
                    </span>
                    <span className="fleet-attn-flag-num">{a.pendingApps > 99 ? '99+' : a.pendingApps}</span>
                  </Link>
                ) : null}
                {a.pendingEmployment > 0 ? (
                  <Link
                    to={`/zapytania-kierowcow?carId=${encodeURIComponent(cid)}`}
                    className="fleet-attn-flag fleet-attn-flag--emp"
                    aria-label={t('fleet.attentionEmpBadge', { count: a.pendingEmployment })}
                  >
                    <span className="fleet-attn-flag-emoji" aria-hidden>
                      🤝
                    </span>
                    <span className="fleet-attn-flag-num">{a.pendingEmployment > 99 ? '99+' : a.pendingEmployment}</span>
                  </Link>
                ) : null}
                {a.chatAttention > 0 && chatHref ? (
                  <Link to={chatHref} className="fleet-attn-flag fleet-attn-flag--chat" aria-label={t('fleet.attentionChatBadge', { count: a.chatAttention })}>
                    <span className="fleet-attn-flag-emoji" aria-hidden>
                      💬
                    </span>
                    <span className="fleet-attn-flag-num">{a.chatAttention > 99 ? '99+' : a.chatAttention}</span>
                  </Link>
                ) : null}
              </div>
              <Link to={carPath(String(car.id), true)} className="car-tile-link">
                <div className="fleet-car-photo" aria-hidden>
                  <img src={tilePhoto || '/images/car-placeholder.png'} alt="" className="fleet-car-photo-img" loading="lazy" />
                </div>
                <div className="car-mobile-card-head">
                  <p className="car-tile-plate">{car.plate_number}</p>
                  <p className="car-tile-rent">{Number(car.weekly_rent_pln ?? 0).toLocaleString(lc, { style: 'currency', currency: 'PLN' })}<span className="car-tile-rent-suffix"> {t('fleet.rentSuffix')}</span></p>
                </div>
                <p className="car-mobile-meta">{car.model || '—'} · {car.driver_name ?? '—'}</p>
                {car.marketplace_listed && !car.driver_id ? (
                  <p className="muted small car-tile-catalog-views" aria-label={t('marketplace.viewCountAria', { count: Number(car.marketplace_view_count ?? 0).toLocaleString(lc) })}>
                    {t('marketplace.viewCountLine', { count: Number(car.marketplace_view_count ?? 0).toLocaleString(lc) })}
                  </p>
                ) : null}
                <FleetDocDots car={car} />
              </Link>
              <div className="car-tile-actions">
                <button type="button" className="btn btn-tile ghost" onClick={() => { setEditing(car); setModalOpen(true) }}>{t('fleet.edit')}</button>
                <button type="button" className="btn btn-tile danger" onClick={() => handleDelete(car)}>{t('fleet.delete')}</button>
              </div>
            </article>
          )
        })}
      </div>
      <CarFormModal open={modalOpen} onClose={() => setModalOpen(false)} car={editing} drivers={drivers} onSaved={() => refresh?.()} />
    </div>
  )
}
