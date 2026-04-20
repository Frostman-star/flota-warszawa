/**
 * Resize image to fit inside maxSide×maxSide, output JPEG.
 * Uses createImageBitmap when possible; falls back to HTMLImageElement (helps HEIC / some mobile picks).
 * @param {File} file
 * @param {{ maxSide?: number, quality?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function compressImageToJpeg(file, opts = {}) {
  const maxSide = opts.maxSide ?? 1200
  const quality = opts.quality ?? 0.85

  /** @type {ImageBitmap | HTMLImageElement} */
  let drawable
  /** @type {(() => void) | null} */
  let dispose = null

  try {
    try {
      const bitmap = await createImageBitmap(file)
      drawable = bitmap
      dispose = () => bitmap.close()
    } catch {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('image_decode'))
        }
        img.src = url
      })
      drawable = img
      dispose = () => URL.revokeObjectURL(url)
    }

    const w = drawable instanceof ImageBitmap ? drawable.width : drawable.naturalWidth
    const h = drawable instanceof ImageBitmap ? drawable.height : drawable.naturalHeight
    const scale = Math.min(1, maxSide / Math.max(w, h, 1))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(drawable, 0, 0, tw, th)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
    })
    return blob
  } finally {
    dispose?.()
  }
}
