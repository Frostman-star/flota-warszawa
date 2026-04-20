/**
 * Normalized rectangle (0–1) relative to image width/height.
 * Reserved for a future manual crop UI — pass as `overrideRect` to skip heuristics.
 * @typedef {{ x: number, y: number, w: number, h: number }} PlateBlurRectNorm
 */

/** @type {Readonly<Record<string, PlateBlurRectNorm>>} */
const HEURISTIC_PRESETS = Object.freeze({
  // Front / rear corners: plate usually lower-center (approximate; widened to catch more frames).
  front_left: { x: 0.04, y: 0.55, w: 0.92, h: 0.45 },
  rear_right: { x: 0.04, y: 0.55, w: 0.92, h: 0.45 },
})

/**
 * @param {string} angleKey
 * @returns {boolean}
 */
export function supportsHeuristicPlateBlur(angleKey) {
  return angleKey in HEURISTIC_PRESETS
}

/**
 * @param {string} angleKey
 * @returns {PlateBlurRectNorm | null}
 */
export function defaultPlateBlurRectNorm(angleKey) {
  return HEURISTIC_PRESETS[angleKey] ?? null
}

/**
 * Strong blur on a JPEG blob region (heuristic or manual rect).
 * Returns the input blob unchanged when no region applies.
 *
 * @param {Blob} jpegBlob
 * @param {{ angleKey: string, overrideRect?: PlateBlurRectNorm | null, quality?: number }} opts
 * @returns {Promise<Blob>}
 */
export async function applyHeuristicPlateBlurToJpegBlob(jpegBlob, opts) {
  const quality = opts.quality ?? 0.88
  const rectNorm = opts.overrideRect ?? defaultPlateBlurRectNorm(opts.angleKey)
  if (!rectNorm) return jpegBlob

  const bitmap = await createImageBitmap(jpegBlob)
  try {
    const w = bitmap.width
    const h = bitmap.height
    let rx = Math.floor(rectNorm.x * w)
    let ry = Math.floor(rectNorm.y * h)
    let rw = Math.ceil(rectNorm.w * w)
    let rh = Math.ceil(rectNorm.h * h)
    rx = Math.max(0, Math.min(rx, w - 2))
    ry = Math.max(0, Math.min(ry, h - 2))
    rw = Math.max(2, Math.min(rw, w - rx))
    rh = Math.max(2, Math.min(rh, h - ry))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0)

    const strip = document.createElement('canvas')
    strip.width = rw
    strip.height = rh
    const sctx = strip.getContext('2d')
    if (!sctx) throw new Error('canvas')
    sctx.drawImage(canvas, rx, ry, rw, rh, 0, 0, rw, rh)

    /** @param {number} factor */
    const mosaicPass = (factor) => {
      const sw = Math.max(1, Math.round(rw / factor))
      const sh = Math.max(1, Math.round(rh / factor))
      const low = document.createElement('canvas')
      low.width = sw
      low.height = sh
      const lctx = low.getContext('2d')
      if (!lctx) throw new Error('canvas')
      lctx.imageSmoothingEnabled = true
      lctx.imageSmoothingQuality = 'low'
      lctx.drawImage(strip, 0, 0, rw, rh, 0, 0, sw, sh)
      sctx.clearRect(0, 0, rw, rh)
      sctx.imageSmoothingEnabled = true
      sctx.imageSmoothingQuality = 'low'
      sctx.drawImage(low, 0, 0, sw, sh, 0, 0, rw, rh)
    }
    mosaicPass(10)
    mosaicPass(6)

    ctx.drawImage(strip, 0, 0, rw, rh, rx, ry, rw, rh)

    const out = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
    })
    return out
  } finally {
    bitmap.close()
  }
}
