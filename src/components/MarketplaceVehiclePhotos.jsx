import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Camera, Car, ImagePlus, Lightbulb, Sofa } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { compressImageToJpeg } from '../utils/imageCanvasCompress'
import { applyHeuristicPlateBlurToJpegBlob, supportsHeuristicPlateBlur } from '../utils/imagePlateBlur'
import {
  VEHICLE_PHOTO_LABELS_DB,
  VEHICLE_PHOTO_OPTIONAL,
  VEHICLE_PHOTO_REQUIRED,
} from '../utils/vehiclePhotoAngles'
import { useVehiclePhotos } from '../hooks/useVehiclePhotos'
import { PhotoFullscreenViewer } from './PhotoFullscreenViewer'
import { VehiclePhotoPlatePreviewModal } from './VehiclePhotoPlatePreviewModal'

const PLATE_BLUR_LS = 'flota_mvp_plate_blur_v1'

function readPlateBlurPref() {
  try {
    return localStorage.getItem(PLATE_BLUR_LS) !== '0'
  } catch {
    return true
  }
}

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
  const [blurPlate, setBlurPlate] = useState(() => readPlateBlurPref())
  const [pendingPlatePreview, setPendingPlatePreview] = useState(/** @type {{ blob: Blob, angleKey: string } | null} */ (null))
  const [platePreviewBusy, setPlatePreviewBusy] = useState(false)
  const inputRef = useRef(null)
  const pendingAngleRef = useRef(null)
  const tipsRef = useRef(null)
  const blurRef = useRef(null)
  const optionalRef = useRef(null)

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

  const commitVehiclePhotoUpload = useCallback(
    async (blob, angleKey) => {
      const ownerId = String(car?.owner_id ?? userId)
      if (!car?.id || !userId) return
      const path = `${ownerId}/${car.id}/${angleKey}.jpg`
      const { error: upErr } = await supabase.storage.from('vehicle-photos').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
      const publicUrl = pub?.publicUrl
      if (!publicUrl) throw new Error('publicUrl')
      const photoUrlForDb = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`

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
        photo_url: photoUrlForDb,
        is_primary: isPrimary,
      })
      if (insErr) throw insErr

      if (isPrimary) {
        let cq = supabase
          .from('cars')
          .update({ primary_photo_url: photoUrlForDb, marketplace_photo_url: photoUrlForDb })
          .eq('id', car.id)
        cq = cq.eq('owner_id', userId)
        const { error: cErr } = await cq
        if (cErr) throw cErr
      }

      await refresh()
      onUpdated?.()
    },
    [car?.id, car?.owner_id, userId, refresh, onUpdated]
  )

  const handlePlatePreviewCancel = useCallback(() => {
    if (platePreviewBusy) return
    setPendingPlatePreview(null)
    setBusyAngle(null)
  }, [platePreviewBusy])

  const handlePlatePreviewConfirm = useCallback(
    async (/** @type {{ mode: 'blur' | 'none'; rect?: { x: number, y: number, w: number, h: number } }} */ payload) => {
      const pending = pendingPlatePreview
      if (!pending || platePreviewBusy) return
      setPlatePreviewBusy(true)
      try {
        let b = pending.blob
        const { angleKey } = pending
        if (payload.mode === 'blur' && payload.rect) {
          b = await applyHeuristicPlateBlurToJpegBlob(b, { angleKey, overrideRect: payload.rect })
        }
        await commitVehiclePhotoUpload(b, angleKey)
        setPendingPlatePreview(null)
        setBusyAngle(null)
      } catch (err) {
        console.error(err)
        window.alert(err instanceof Error ? err.message : String(err))
      } finally {
        setPlatePreviewBusy(false)
      }
    },
    [pendingPlatePreview, platePreviewBusy, commitVehiclePhotoUpload]
  )

  const onFile = useCallback(
    async (e) => {
      const angleKey = pendingAngleRef.current
      pendingAngleRef.current = null
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !angleKey || !car?.id || !userId) return

      setBusyAngle(angleKey)
      let deferBusyClear = false
      try {
        const blob = await compressImageToJpeg(file, { maxSide: 1200, quality: 0.85 })
        if (blurPlate && supportsHeuristicPlateBlur(angleKey)) {
          setPendingPlatePreview({ blob, angleKey })
          deferBusyClear = true
          return
        }
        await commitVehiclePhotoUpload(blob, angleKey)
      } catch (err) {
        console.error(err)
        window.alert(err instanceof Error ? err.message : String(err))
      } finally {
        if (!deferBusyClear) setBusyAngle(null)
      }
    },
    [car?.id, car?.owner_id, userId, commitVehiclePhotoUpload, blurPlate]
  )

  function openFsFromAngle(angleKey) {
    const i = fsSlides.findIndex((s) => s.angleKey === angleKey)
    if (i < 0) return
    setFsIdx(i)
    setFsOpen(true)
  }

  function slotIcon(angleKey) {
    const ic = { size: 22, strokeWidth: 2, className: 'mvp-slot-lucide' }
    switch (angleKey) {
      case 'front_left':
        return <Car {...ic} aria-hidden />
      case 'rear_right':
        return <Car {...ic} className="mvp-slot-lucide mvp-slot-lucide--flip" aria-hidden />
      case 'interior_front':
        return <Sofa {...ic} aria-hidden />
      case 'interior_rear':
        return <Sofa {...ic} aria-hidden />
      default:
        return <ImagePlus {...ic} aria-hidden />
    }
  }

  const scrollTo = useCallback((el) => {
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const openOptionalAndScroll = useCallback(() => {
    setOptOpen(true)
    requestAnimationFrame(() => {
      optionalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [])

  /**
   * @param {{ key: string, required: boolean }} def
   * @param {boolean} [quad] — єдина сітка 2×2 у верхній картці (макет «фото оголошення»)
   */
  function renderSlot(def, quad = false) {
    const row = byAngle.get(def.key)
    const has = Boolean(row?.photo_url)
    const busy = busyAngle === def.key
    return (
      <div key={def.key} className={`mvp-slot${has ? ' mvp-slot--done' : ''}${quad ? ' mvp-slot--quad' : ''}`}>
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
              <ImagePlus size={36} strokeWidth={1.6} className="mvp-slot-ph-icon" />
            </span>
            <span className="mvp-slot-cta muted small">{t('marketplacePhotos.addPhoto')}</span>
          </button>
        )}
        {busy ? <span className="mvp-slot-busy muted small">{t('app.loading')}</span> : null}
      </div>
    )
  }

  const tipsList = (
    <ul className={embed ? 'mvp-cyber-tip-list' : 'mvp-tip-list muted small'}>
      <li>{t('marketplacePhotos.tip1')}</li>
      <li>{t('marketplacePhotos.tip2')}</li>
      <li>{t('marketplacePhotos.tip3')}</li>
      <li>{t('marketplacePhotos.tip4')}</li>
    </ul>
  )

  const plateBlurBlock = (
    <label className="mvp-plate-blur-row">
      <input
        type="checkbox"
        checked={blurPlate}
        onChange={(e) => {
          const v = e.target.checked
          setBlurPlate(v)
          try {
            localStorage.setItem(PLATE_BLUR_LS, v ? '1' : '0')
          } catch {
            /* ignore */
          }
        }}
      />
      <span>{t('marketplacePhotos.plateBlurCheckbox')}</span>
    </label>
  )

  const plateBlurHint = <p className="muted small mvp-plate-blur-hint mb-0">{t('marketplacePhotos.plateBlurHint')}</p>

  return (
    <section className={embed ? 'mvp-section mvp-section--embed mvp-section--cyber' : 'detail-block mvp-section'}>
      {embed ? null : <h2>{t('marketplacePhotos.sectionTitle')}</h2>}

      {embed ? (
        <>
          <div className="mvp-cyber-card mvp-cyber-card--hero card pad-lg">
            <div className="mvp-cyber-hero-mock">
              <div className="mvp-cyber-hero-copy">
                <div className="mvp-cyber-head">
                  <span className="mvp-cyber-orb" aria-hidden>
                    <Camera size={22} strokeWidth={2.1} />
                  </span>
                  <div>
                    <h3 className="mvp-cyber-title">{t('marketplacePhotos.heroHeading')}</h3>
                    <p className="mvp-cyber-lead muted small">{t('marketplacePhotos.heroLead')}</p>
                  </div>
                </div>
                <p className="mvp-cyber-progress muted small">
                  {t('marketplacePhotos.requiredHeading', { done: requiredDone, total: VEHICLE_PHOTO_REQUIRED.length })}
                </p>
                <nav className="mvp-cyber-hero-nav" aria-label={t('marketplacePhotos.railKicker')}>
                  <button type="button" className="mvp-text-link" onClick={() => scrollTo(tipsRef.current)}>
                    {t('marketplacePhotos.railTips')}
                  </button>
                  <span className="mvp-cyber-hero-nav-sep" aria-hidden>
                    ·
                  </span>
                  <button type="button" className="mvp-text-link" onClick={() => scrollTo(blurRef.current)}>
                    {t('marketplacePhotos.railPlate')}
                  </button>
                  <span className="mvp-cyber-hero-nav-sep" aria-hidden>
                    ·
                  </span>
                  <button type="button" className="mvp-text-link" onClick={openOptionalAndScroll}>
                    {t('marketplacePhotos.railOptional')}
                  </button>
                </nav>
              </div>
              <div className="mvp-cyber-hero-quad" role="group" aria-label={t('marketplacePhotos.requiredHeading', { done: requiredDone, total: VEHICLE_PHOTO_REQUIRED.length })}>
                {VEHICLE_PHOTO_REQUIRED.map((d) => renderSlot(d, true))}
              </div>
            </div>
          </div>

          <div ref={tipsRef} className="mvp-cyber-card card pad-lg">
            <div className="mvp-cyber-split mvp-cyber-split--tips">
              <div className="mvp-cyber-copy">
                <div className="mvp-cyber-head">
                  <span className="mvp-cyber-orb" aria-hidden>
                    <Lightbulb size={22} strokeWidth={2.1} />
                  </span>
                  <h3 className="mvp-cyber-title">{t('marketplacePhotos.tipsTitle')}</h3>
                </div>
                {tipsList}
              </div>
              <div className="mvp-cyber-viz mvp-cyber-viz--car" aria-hidden />
            </div>
          </div>

          <div ref={blurRef} className="mvp-cyber-card mvp-cyber-plate card pad-lg">
            <div className="mvp-cyber-split mvp-cyber-split--tips">
              <div className="mvp-cyber-copy">
                <div className="mvp-cyber-head mvp-cyber-head--blur">
                  <span className="mvp-cyber-orb" aria-hidden>
                    <BadgeCheck size={22} strokeWidth={2.1} />
                  </span>
                  <div className="mvp-cyber-blur-fields">
                    {plateBlurBlock}
                    {plateBlurHint}
                  </div>
                </div>
              </div>
              <div className="mvp-cyber-viz mvp-cyber-viz--plate" aria-hidden />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mvp-tip card">
            <p className="mvp-tip-title">💡 {t('marketplacePhotos.tipsTitle')}</p>
            {tipsList}
          </div>

          <div className="mvp-plate-blur card pad-lg">
            {plateBlurBlock}
            {plateBlurHint}
          </div>

          <h3 className="mvp-subhead">
            {t('marketplacePhotos.requiredHeading', { done: requiredDone, total: VEHICLE_PHOTO_REQUIRED.length })}
          </h3>
          <div className="mvp-grid">{VEHICLE_PHOTO_REQUIRED.map((d) => renderSlot(d))}</div>
        </>
      )}

      <div ref={optionalRef} className={embed ? 'mvp-cyber-optional' : undefined}>
        {embed ? (
          <button type="button" className="mvp-expand mvp-text-link" onClick={() => setOptOpen((o) => !o)}>
            {optOpen ? '▼ ' : '▶ '}
            {t('marketplacePhotos.optionalHeading')}
          </button>
        ) : (
          <button type="button" className="mvp-expand btn ghost" onClick={() => setOptOpen((o) => !o)}>
            {optOpen ? '▼' : '▶'} {t('marketplacePhotos.optionalHeading')}
          </button>
        )}
        {optOpen ? (
          <div className={`mvp-grid mvp-grid--opt${embed ? ' mvp-grid--cyber' : ''}`}>{VEHICLE_PHOTO_OPTIONAL.map((d) => renderSlot(d))}</div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFile}
      />

      {fsOpen && fsSlides.length ? (
        <PhotoFullscreenViewer open={fsOpen} slides={fsSlides} initialIndex={fsIdx} onClose={() => setFsOpen(false)} />
      ) : null}

      {pendingPlatePreview ? (
        <VehiclePhotoPlatePreviewModal
          open
          jpegBlob={pendingPlatePreview.blob}
          angleKey={pendingPlatePreview.angleKey}
          busy={platePreviewBusy}
          onCancel={handlePlatePreviewCancel}
          onConfirm={handlePlatePreviewConfirm}
        />
      ) : null}
    </section>
  )
}
