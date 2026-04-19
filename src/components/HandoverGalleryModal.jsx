import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useHandoverPhotos } from '../hooks/useCarHandovers'

/**
 * @param {{ open: boolean, handoverId: string | null, onClose: () => void }} props
 */
export function HandoverGalleryModal({ open, handoverId, onClose }) {
  const { t } = useTranslation()
  const { photos, loading } = useHandoverPhotos(handoverId, open)
  const trackRef = useRef(null)
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)
  const pinchRef = useRef({ dist: 0, base: 1 })

  useEffect(() => {
    if (!open) {
      setIdx(0)
      setScale(1)
    }
  }, [open])

  useEffect(() => {
    setScale(1)
  }, [idx])

  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || photos.length === 0) return
    const w = el.clientWidth || 1
    const i = Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / w)))
    setIdx(i)
  }, [photos.length])

  const angleLabel = (a) => t(`handover.angle.${a}`, { defaultValue: a })

  const download = async (url, angle) => {
    try {
      const r = await fetch(url)
      const b = await r.blob()
      const a = document.createElement('a')
      const u = URL.createObjectURL(b)
      a.href = u
      a.download = `${angle}-${(handoverId ?? '').slice(0, 8) || 'photo'}.jpg`
      a.click()
      URL.revokeObjectURL(u)
    } catch (e) {
      console.error(e)
    }
  }

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { dist: Math.hypot(dx, dy), base: scale }
    }
  }

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current.dist > 0) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const d = Math.hypot(dx, dy)
      const ratio = d / pinchRef.current.dist
      const next = Math.min(4, Math.max(1, pinchRef.current.base * ratio))
      setScale(next)
    }
  }

  const onTouchEnd = () => {
    pinchRef.current = { dist: 0, base: 1 }
  }

  if (!open || !handoverId) return null

  const cur = photos[idx]

  return createPortal(
    <div className="handover-gallery-backdrop" role="dialog" aria-modal="true" aria-label={t('handover.galleryTitle')}>
      <div className="handover-gallery-bar">
        <button type="button" className="btn ghost handover-gallery-close" onClick={onClose}>
          {t('handover.galleryClose')}
        </button>
        {cur ? (
          <button type="button" className="btn secondary handover-gallery-dl" onClick={() => download(cur.photo_url, cur.angle)}>
            {t('handover.download')}
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="muted handover-gallery-loading">{t('app.loading')}</p>
      ) : photos.length === 0 ? (
        <p className="muted handover-gallery-loading">{t('handover.noPhotos')}</p>
      ) : (
        <>
          <div ref={trackRef} className="handover-gallery-track" onScroll={onScroll}>
            {photos.map((p, i) => (
              <div key={p.id} className="handover-gallery-slide">
                <div
                  className="handover-gallery-zoom"
                  onTouchStart={i === idx ? onTouchStart : undefined}
                  onTouchMove={i === idx ? onTouchMove : undefined}
                  onTouchEnd={i === idx ? onTouchEnd : undefined}
                  style={{ transform: i === idx ? `scale(${scale})` : 'scale(1)' }}
                >
                  <img src={p.photo_url} alt={angleLabel(p.angle)} className="handover-gallery-img" draggable={false} />
                </div>
              </div>
            ))}
          </div>
          <p className="handover-gallery-caption">
            {cur ? (
              <>
                <strong>{angleLabel(cur.angle)}</strong>
                <span className="muted"> · {idx + 1}/{photos.length}</span>
              </>
            ) : null}
          </p>
        </>
      )}
    </div>,
    document.body
  )
}
