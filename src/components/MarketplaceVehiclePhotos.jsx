import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { compressImageToJpeg } from '../utils/imageCanvasCompress'
import {
  VEHICLE_PHOTO_LABELS_DB,
  VEHICLE_PHOTO_OPTIONAL,
  VEHICLE_PHOTO_REQUIRED,
} from '../utils/vehiclePhotoAngles'
import { useVehiclePhotos } from '../hooks/useVehiclePhotos'
import { PhotoFullscreenViewer } from './PhotoFullscreenViewer'

/**
 * @param {{
 *   car: Record<string, unknown>,
 *   userId: string,
 *   onUpdated?: () => void,
 *   embed?: boolean,
 * }} props
 */
export function MarketplaceVehiclePhotos({ car, userId, onUpdated, embed = false }) {
  const { t } = useTranslation()
  const { photos, refresh } = useVehiclePhotos(car?.id)
  const [busyAngle, setBusyAngle] = useState(null)
  const [optOpen, setOptOpen] = useState(false)
  const [fsOpen, setFsOpen] = useState(false)
  const [fsIdx, setFsIdx] = useState(0)
  const inputRef = useRef(null)
  const pendingAngleRef = useRef(null)

  const byAngle = useMemo(() => {
    const m = new Map()
    for (const p of photos) {
      m.set(String(p.angle_key), p)
    }
    return m
  }, [photos])

  const FS_ORDER = [
    'front_left',
    'rear_right',
    'interior_front',
    'interior_rear',
    'dashboard',
    'trunk',
    'wheels',
    'sunroof',
    'detail',
  ]

  const fsSlides = useMemo(() => {
    const out = []
    for (const k of FS_ORDER) {
      const row = byAngle.get(k)
      if (row?.photo_url) {
        out.push({
          id: String(row.id ?? ''),
          url: String(row.photo_url),
          angleKey: k,
        })
      }
    }
    return out
  }, [byAngle])

  const requiredDone = useMemo(() => {
    let n = 0
    for (const { key } of VEHICLE_PHOTO_REQUIRED) {
      if (byAngle.has(key)) n += 1
    }
    return n
  }, [byAngle])

  const onPickAngle = useCallback((angleKey) => {
    pendingAngleRef.current = angleKey
    inputRef.current?.click()
  }, [])

  const onFile = useCallback(
    async (e) => {
      const angleKey = pendingAngleRef.current
      pendingAngleRef.current = null
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !angleKey || !car?.id || !userId) return

      const ownerId = String(car.owner_id ?? userId)
      setBusyAngle(angleKey)
      try {
        const blob = await compressImageToJpeg(file, { maxSide: 1200, quality: 0.85 })
        const path = `${ownerId}/${car.id}/${angleKey}.jpg`
        const { error: upErr } = await supabase.storage.from('vehicle-photos').upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })
        if (upErr) throw upErr

        const { data: pub } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
        const publicUrl = pub?.publicUrl
        if (!publicUrl) throw new Error('publicUrl')

        const labels = VEHICLE_PHOTO_LABELS_DB[angleKey]
        if (!labels) throw new Error('angle')

        const isPrimary = angleKey === 'front_left'

        const { error: delErr } = await supabase.from('vehicle_photos').delete().eq('vehicle_id', car.id).eq('angle_key', angleKey)
        if (delErr) throw delErr

        const { error: insErr } = await supabase.from('vehicle_photos').insert({
          vehicle_id: car.id,
          owner_id: userId,
          angle_key: angleKey,
          angle_label_pl: labels.pl,
          angle_label_uk: labels.uk,
          photo_url: publicUrl,
          is_primary: isPrimary,
        })
        if (insErr) throw insErr

        if (isPrimary) {
          let cq = supabase
            .from('cars')
            .update({ primary_photo_url: publicUrl, marketplace_photo_url: publicUrl })
            .eq('id', car.id)
          cq = cq.eq('owner_id', userId)
          const { error: cErr } = await cq
          if (cErr) throw cErr
        }

        await refresh()
        onUpdated?.()
      } catch (err) {
        console.error(err)
        window.alert(err instanceof Error ? err.message : String(err))
      } finally {
        setBusyAngle(null)
      }
    },
    [car?.id, car?.owner_id, userId, refresh, onUpdated]
  )

  function openFsFromAngle(angleKey) {
    const i = fsSlides.findIndex((s) => s.angleKey === angleKey)
    if (i < 0) return
    setFsIdx(i)
    setFsOpen(true)
  }

  function slotIcon(angleKey) {
    switch (angleKey) {
      case 'front_left':
        return <span className="mvp-slot-diag mvp-slot-diag--fl" aria-hidden>🚗↖</span>
      case 'rear_right':
        return <span className="mvp-slot-diag mvp-slot-diag--rr" aria-hidden>🚗↘</span>
      case 'interior_front':
        return <span aria-hidden>🪑</span>
      case 'interior_rear':
        return <span aria-hidden>🪑🪑</span>
      default:
        return <span aria-hidden>📷</span>
    }
  }

  /**
   * @param {{ key: string, required: boolean }} def
   */
  function renderSlot(def) {
    const row = byAngle.get(def.key)
    const has = Boolean(row?.photo_url)
    const busy = busyAngle === def.key
    return (
      <div key={def.key} className={`mvp-slot${has ? ' mvp-slot--done' : ''}`}>
        <p className="mvp-slot-label">{t(`marketplacePhotos.angle.${def.key}`)}</p>
        <div className="mvp-slot-icon muted small">{slotIcon(def.key)}</div>
        {has ? (
          <div className="mvp-slot-body mvp-slot-body--has">
            <button
              type="button"
              className="mvp-slot-thumb-btn"
              disabled={Boolean(busy)}
              onClick={() => openFsFromAngle(def.key)}
              aria-label={t('photoFullscreen.open')}
            >
              <img src={String(row.photo_url)} alt="" className="mvp-slot-thumb" />
              <span className="mvp-slot-check" aria-hidden>
                ✓
              </span>
            </button>
            <button type="button" className="mvp-slot-change-btn" disabled={Boolean(busy)} onClick={() => onPickAngle(def.key)}>
              {t('marketplacePhotos.change')}
            </button>
          </div>
        ) : (
          <button type="button" className="mvp-slot-body" disabled={Boolean(busy)} onClick={() => onPickAngle(def.key)}>
            <span className="mvp-slot-ph" aria-hidden>
              📷
            </span>
            <span className="mvp-slot-cta muted small">{t('marketplacePhotos.addPhoto')}</span>
          </button>
        )}
        {busy ? <span className="mvp-slot-busy muted small">{t('app.loading')}</span> : null}
      </div>
    )
  }

  return (
    <section className={embed ? 'mvp-section mvp-section--embed' : 'detail-block mvp-section'}>
      {embed ? null : <h2>{t('marketplacePhotos.sectionTitle')}</h2>}

      <div className="mvp-tip card">
        <p className="mvp-tip-title">💡 {t('marketplacePhotos.tipsTitle')}</p>
        <ul className="mvp-tip-list muted small">
          <li>{t('marketplacePhotos.tip1')}</li>
          <li>{t('marketplacePhotos.tip2')}</li>
          <li>{t('marketplacePhotos.tip3')}</li>
          <li>{t('marketplacePhotos.tip4')}</li>
        </ul>
      </div>

      <h3 className="mvp-subhead">
        {t('marketplacePhotos.requiredHeading', { done: requiredDone, total: VEHICLE_PHOTO_REQUIRED.length })}
      </h3>
      <div className="mvp-grid">{VEHICLE_PHOTO_REQUIRED.map((d) => renderSlot(d))}</div>

      <button type="button" className="mvp-expand btn ghost" onClick={() => setOptOpen((o) => !o)}>
        {optOpen ? '▼' : '▶'} {t('marketplacePhotos.optionalHeading')}
      </button>
      {optOpen ? <div className="mvp-grid mvp-grid--opt">{VEHICLE_PHOTO_OPTIONAL.map((d) => renderSlot(d))}</div> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFile}
      />

      {fsOpen && fsSlides.length ? (
        <PhotoFullscreenViewer open={fsOpen} slides={fsSlides} initialIndex={fsIdx} onClose={() => setFsOpen(false)} />
      ) : null}
    </section>
  )
}
