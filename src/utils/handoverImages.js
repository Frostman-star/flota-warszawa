/**
 * Resize and compress image for upload (mobile / poor network).
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality 0..1
 * @returns {Promise<Blob>}
 */
export async function compressImageToJpeg(file, maxWidth = 1200, quality = 0.8) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    bitmap = null
  }

  const render = (source, w0, h0) => {
    const scale = Math.min(1, maxWidth / w0)
    const w = Math.max(1, Math.round(w0 * scale))
    const h = Math.max(1, Math.round(h0 * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unsupported')
    ctx.drawImage(source, 0, 0, w, h)
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
    })
  }

  if (bitmap) {
    try {
      return await render(bitmap, bitmap.width, bitmap.height)
    } finally {
      bitmap.close?.()
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      URL.revokeObjectURL(url)
      try {
        const blob = await render(img, img.naturalWidth, img.naturalHeight)
        resolve(blob)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} maxAttempts
 * @param {number} baseDelayMs
 */
export async function retryAsync(fn, maxAttempts = 4, baseDelayMs = 400) {
  let lastErr
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === maxAttempts - 1) break
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}
