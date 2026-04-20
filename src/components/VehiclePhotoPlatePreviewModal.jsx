import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultPlateBlurRectNorm } from '../utils/imagePlateBlur'

/** @typedef {{ x: number, y: number, w: number, h: number }} PxRect */

const HANDLE = 14
const MIN_W = 48
const MIN_H = 28

/**
 * @param {{ clientX: number, clientY: number }} e
 * @param {HTMLCanvasElement} canvas
 */
function clientToCanvas(e, canvas) {
  const r = canvas.getBoundingClientRect()
  const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * canvas.width
  const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * canvas.height
  return { x, y }
}

/**
 * @param {{ x: number, y: number }} p
 * @param {PxRect} box
 * @param {number} cornerR
 */
function hitCorner(p, box, cornerR) {
  const c = [
    { id: 'nw', x: box.x, y: box.y },
    { id: 'ne', x: box.x + box.w, y: box.y },
    { id: 'sw', x: box.x, y: box.y + box.h },
    { id: 'se', x: box.x + box.w, y: box.y + box.h },
  ]
  for (const h of c) {
    if (Math.abs(p.x - h.x) <= cornerR && Math.abs(p.y - h.y) <= cornerR) return h.id
  }
  return null
}

/**
 * @param {{ open: boolean, jpegBlob: Blob, angleKey: string, busy?: boolean, onCancel: () => void, onConfirm: (p: { mode: 'blur' | 'none'; rect?: { x: number, y: number, w: number, h: number } }) => void }} props
 */
export function VehiclePhotoPlatePreviewModal({ open, jpegBlob, angleKey, busy = false, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null))
  const [natural, setNatural] = useState(/** @type {HTMLImageElement | null} */ (null))
  const [cw, setCw] = useState(0)
  const [ch, setCh] = useState(0)
  /** @type {import('react').MutableRefObject<PxRect | null>} */
  const rectRef = useRef(null)
  const [rectTick, setRectTick] = useState(0)
  const dragRef = useRef(/** @type {{ mode: string; startX: number; startY: number; startRect: PxRect } | null} */ (null))

  const bumpRect = useCallback(() => {
    setRectTick((n) => n + 1)
  }, [])

  const initFromPreset = useCallback(() => {
    if (!cw || !ch) return
    const norm = defaultPlateBlurRectNorm(angleKey)
    if (!norm) return
    rectRef.current = {
      x: Math.round(norm.x * cw),
      y: Math.round(norm.y * ch),
      w: Math.max(MIN_W, Math.round(norm.w * cw)),
      h: Math.max(MIN_H, Math.round(norm.h * ch)),
    }
    bumpRect()
  }, [angleKey, cw, ch, bumpRect])

  useEffect(() => {
    if (!open || !jpegBlob) {
      setNatural(null)
      setCw(0)
      setCh(0)
      rectRef.current = null
      return
    }
    const url = URL.createObjectURL(jpegBlob)
    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (cancelled) return
      const maxW = Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 40 : 560, img.naturalWidth)
      const scale = maxW / Math.max(img.naturalWidth, 1)
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      setCw(w)
      setCh(h)
      setNatural(img)
      const norm = defaultPlateBlurRectNorm(angleKey)
      if (norm) {
        rectRef.current = {
          x: Math.round(norm.x * w),
          y: Math.round(norm.y * h),
          w: Math.max(MIN_W, Math.round(norm.w * w)),
          h: Math.max(MIN_H, Math.round(norm.h * h)),
        }
      } else {
        rectRef.current = null
      }
      bumpRect()
    }
    img.src = url
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [open, jpegBlob, angleKey, bumpRect])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = natural
    const r = rectRef.current
    if (!open || !canvas || !img || !cw || !ch || !r) return
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, cw, ch)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.95)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    ctx.setLineDash([])
    const corners = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ]
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
    for (const [cx, cy] of corners) {
      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [open, natural, cw, ch, rectTick])

  const clampRect = useCallback((q, canvasW, canvasH) => {
    let { x, y, w, h } = q
    w = Math.max(MIN_W, Math.min(w, canvasW))
    h = Math.max(MIN_H, Math.min(h, canvasH))
    x = Math.max(0, Math.min(x, canvasW - w))
    y = Math.max(0, Math.min(y, canvasH - h))
    return { x, y, w, h }
  }, [])

  const onPointerDown = useCallback(
    (e) => {
      if (busy) return
      const canvas = canvasRef.current
      const r0 = rectRef.current
      if (!canvas || !r0 || !cw || !ch) return
      const p = clientToCanvas(e, canvas)
      const corner = hitCorner(p, r0, HANDLE)
      if (corner) {
        dragRef.current = { mode: `resize-${corner}`, startX: p.x, startY: p.y, startRect: { ...r0 } }
      } else if (p.x >= r0.x && p.x <= r0.x + r0.w && p.y >= r0.y && p.y <= r0.y + r0.h) {
        dragRef.current = { mode: 'move', startX: p.x, startY: p.y, startRect: { ...r0 } }
      } else {
        return
      }
      canvas.setPointerCapture(e.pointerId)
    },
    [cw, ch, busy]
  )

  const onPointerMove = useCallback(
    (e) => {
      if (busy) return
      const d = dragRef.current
      const canvas = canvasRef.current
      if (!d || !canvas || !cw || !ch) return
      const p = clientToCanvas(e, canvas)
      const dx = p.x - d.startX
      const dy = p.y - d.startY
      const s = d.startRect
      let next = { ...s }
      if (d.mode === 'move') {
        next.x = s.x + dx
        next.y = s.y + dy
      } else if (d.mode === 'resize-se') {
        next.w = s.w + dx
        next.h = s.h + dy
      } else if (d.mode === 'resize-sw') {
        next.x = s.x + dx
        next.w = s.w - dx
        next.h = s.h + dy
      } else if (d.mode === 'resize-ne') {
        next.y = s.y + dy
        next.w = s.w + dx
        next.h = s.h - dy
      } else if (d.mode === 'resize-nw') {
        next.x = s.x + dx
        next.y = s.y + dy
        next.w = s.w - dx
        next.h = s.h - dy
      }
      rectRef.current = clampRect(next, cw, ch)
      bumpRect()
    },
    [clampRect, cw, ch, bumpRect, busy]
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      const canvas = canvasRef.current
      if (canvas?.hasPointerCapture?.(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      endDrag()
    },
    [endDrag]
  )

  const handleConfirmBlur = useCallback(() => {
    if (busy) return
    const r = rectRef.current
    if (!r || !cw || !ch) return
    onConfirm({
      mode: 'blur',
      rect: { x: r.x / cw, y: r.y / ch, w: r.w / cw, h: r.h / ch },
    })
  }, [cw, ch, onConfirm, busy])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card card pad-lg plate-preview-modal" role="dialog" aria-modal="true" aria-labelledby="plate-prev-title">
        <h2 id="plate-prev-title" className="modal-title">
          {t('marketplacePhotos.platePreviewTitle')}
        </h2>
        <p className="muted small">{t('marketplacePhotos.platePreviewLead')}</p>
        <p className="muted small">{t(`marketplacePhotos.angle.${angleKey}`)}</p>
        <div className="plate-preview-canvas-wrap">
          {natural && cw > 0 && ch > 0 ? (
            <canvas
              ref={canvasRef}
              className="plate-preview-canvas"
              width={cw}
              height={ch}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ) : (
            <p className="muted small pad-lg mb-0">{t('app.loading')}</p>
          )}
        </div>
        <p className="muted tiny plate-preview-touch-hint">{t('marketplacePhotos.platePreviewTouchHint')}</p>
        <div className="btn-row plate-preview-actions">
          <button type="button" className="btn ghost small" disabled={busy} onClick={initFromPreset}>
            {t('marketplacePhotos.platePreviewReset')}
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => onConfirm({ mode: 'none' })}>
            {t('marketplacePhotos.platePreviewSkipBlur')}
          </button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>
            {t('marketplacePhotos.platePreviewCancel')}
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={handleConfirmBlur}>
            {busy ? t('app.loading') : t('marketplacePhotos.platePreviewConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
