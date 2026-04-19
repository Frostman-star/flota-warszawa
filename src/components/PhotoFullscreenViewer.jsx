import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * @param {{
 *   open: boolean,
 *   slides: Array<{ id?: string, url: string, angleKey?: string }>,
 *   initialIndex?: number,
 *   onClose: () => void,
 * }} props
 */
export function PhotoFullscreenViewer({ open, slides, initialIndex = 0, onClose }) {
  const { t } = useTranslation()
  const [idx, setIdx] = useState(0)
  const [scale, setScale] = useState(1)
  const wrapRef = useRef(null)
  const touchStartX = useRef(null)
  const pinchRef = useRef({ startDist: 0, startScale: 1 })
  const scaleRef = useRef(1)
  scaleRef.current = scale

  useEffect(() => {
    if (!open) return
    setIdx(Math.min(Math.max(0, initialIndex), Math.max(0, slides.length - 1)))
    setScale(1)
  }, [open, initialIndex, slides.length])

  const go = useCallback(
    (delta) => {
      if (slides.length < 2 || scaleRef.current > 1.05) return
      setIdx((i) => {
        const n = slides.length
        return (i + delta + n) % n
      })
    },
    [slides.length]
  )

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, go])

  const slide = slides[idx] ?? null
  const label =
    slide?.angleKey != null ? t(`marketplacePhotos.angle.${slide.angleKey}`, { defaultValue: slide.angleKey }) : ''

  function distance(touches) {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  if (!open || !slide?.url) return null

  return (
    <div
      className="photo-fs"
      role="dialog"
      aria-modal="true"
      aria-label={t('photoFullscreen.title')}
      ref={wrapRef}
      onClick={(e) => {
        if (e.target === wrapRef.current) onClose()
      }}
    >
      <button type="button" className="photo-fs-close" onClick={onClose} aria-label={t('app.close')}>
        ×
      </button>
      {slides.length > 1 ? (
        <p className="photo-fs-counter" aria-live="polite">
          {idx + 1} / {slides.length}
        </p>
      ) : null}
      <div
        className="photo-fs-stage"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinchRef.current = { startDist: distance(e.touches), startScale: scaleRef.current }
          } else if (e.touches.length === 1) {
            touchStartX.current = e.touches[0].clientX
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            e.preventDefault()
            const d0 = pinchRef.current.startDist
            if (d0 < 1) return
            const d1 = distance(e.touches)
            const next = Math.min(4, Math.max(1, (pinchRef.current.startScale * d1) / d0))
            setScale(next)
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length === 0 && e.changedTouches.length === 1 && scaleRef.current <= 1.05) {
            const x = e.changedTouches[0].clientX
            const sx = touchStartX.current
            touchStartX.current = null
            if (sx != null && slides.length > 1) {
              const dx = x - sx
              if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
            }
          }
        }}
      >
        <img
          src={slide.url}
          alt=""
          className="photo-fs-img"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setScale((s) => (s > 1.2 ? 1 : 2.5))}
        />
      </div>
      {slides.length > 1 ? (
        <>
          <button type="button" className="photo-fs-nav photo-fs-nav--prev" onClick={() => go(-1)} aria-label={t('app.back')}>
            ‹
          </button>
          <button type="button" className="photo-fs-nav photo-fs-nav--next" onClick={() => go(1)} aria-label={t('marketplacePhotos.change')}>
            ›
          </button>
        </>
      ) : null}
      {label ? <p className="photo-fs-caption">{label}</p> : null}
    </div>
  )
}
