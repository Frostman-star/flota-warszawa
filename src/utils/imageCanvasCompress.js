/**
 * Resize image to fit inside maxSide×maxSide, output JPEG.
 * @param {File} file
 * @param {{ maxSide?: number, quality?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function compressImageToJpeg(file, opts = {}) {
  const maxSide = opts.maxSide ?? 1200
  const quality = opts.quality ?? 0.85
  const bitmap = await createImageBitmap(file)
  try {
    const w = bitmap.width
    const h = bitmap.height
    const scale = Math.min(1, maxSide / Math.max(w, h, 1))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0, tw, th)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality)
    })
    return blob
  } finally {
    bitmap.close()
  }
}
