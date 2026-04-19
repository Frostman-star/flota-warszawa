import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVehiclePhotos } from '../hooks/useVehiclePhotos'
import { PhotoFullscreenViewer } from './PhotoFullscreenViewer'

/**
 * @param {{ carId: string, primaryFallback?: string | null }} props
 */
export function MarketplaceCarPhotoGallery({ carId, primaryFallback }) {
  const { t } = useTranslation()
  const { photos, loading } = useVehiclePhotos(carId)
  const [mainIdx, setMainIdx] = useState(0)
  const [touchX, setTouchX] = useState(null)
  const [fsOpen, setFsOpen] = useState(false)
  const [fsStart, setFsStart] = useState(0)

  const ordered = useMemo(() => {
    const order = [
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
    const list = [...photos]
    list.sort(
      (a, b) =>
        order.indexOf(String(a.angle_key)) - order.indexOf(String(b.angle_key)) ||
        String(a.created_at).localeCompare(String(b.created_at))
    )
    return list
  }, [photos])

  const slides = useMemo(
    () =>
      ordered
        .filter((p) => p.photo_url)
        .map((p) => ({
          id: String(p.id ?? ''),
          url: String(p.photo_url),
          angleKey: String(p.angle_key ?? ''),
        })),
    [ordered]
  )

  const slidesWithFallback = useMemo(() => {
    if (slides.length) return slides
    const fb = primaryFallback ? String(primaryFallback).trim() : ''
    if (fb) return [{ url: fb, angleKey: 'front_left' }]
    return []
  }, [slides, primaryFallback])

  useEffect(() => {
    setMainIdx(0)
  }, [carId])

  useEffect(() => {
    if (!ordered.length) return
    setMainIdx((i) => Math.min(i, ordered.length - 1))
  }, [ordered.length])

  const main = ordered[mainIdx] ?? null
  const mainUrl = main?.photo_url ? String(main.photo_url) : primaryFallback ? String(primaryFallback) : ''

  const go = useCallback(
    (delta) => {
      if (!ordered.length) return
      setMainIdx((i) => {
        const n = ordered.length
        return (i + delta + n) % n
      })
    },
    [ordered.length]
  )

  function openFs(atIndex) {
    const list = slidesWithFallback
    if (!list.length) return
    const i = Math.min(Math.max(0, atIndex), list.length - 1)
    setFsStart(i)
    setFsOpen(true)
  }

  if (loading && !ordered.length && !primaryFallback) {
    return null
  }

  if (!ordered.length && !primaryFallback) {
    return null
  }

  return (
    <>
      <section className="mvp-gallery" aria-label={t('marketplacePhotos.sectionTitle')}>
        <div
          className="mvp-gallery-main"
          onTouchStart={(e) => setTouchX(e.changedTouches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const x = e.changedTouches[0]?.clientX
            if (touchX == null || x == null || !ordered.length) return
            const dx = x - touchX
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
            setTouchX(null)
          }}
        >
          {mainUrl ? (
            <button type="button" className="mvp-gallery-main-hit" onClick={() => openFs(mainIdx)} aria-label={t('photoFullscreen.open')}>
              <img src={mainUrl} alt="" className="mvp-gallery-main-img" />
            </button>
          ) : (
            <div className="mvp-gallery-main-ph">🚗</div>
          )}
          {ordered.length > 1 ? (
            <>
              <button type="button" className="mvp-gallery-nav mvp-gallery-nav--prev" onClick={() => go(-1)} aria-label={t('app.back')}>
                ‹
              </button>
              <button type="button" className="mvp-gallery-nav mvp-gallery-nav--next" onClick={() => go(1)} aria-label={t('marketplacePhotos.change')}>
                ›
              </button>
            </>
          ) : null}
        </div>
        {main || primaryFallback ? (
          <p className="mvp-gallery-caption muted small">
            {main ? t(`marketplacePhotos.angle.${main.angle_key}`) : t('marketplacePhotos.angle.front_left')}
          </p>
        ) : null}
        {ordered.length > 1 ? (
          <div className="mvp-gallery-thumbs" role="tablist">
            {ordered.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === mainIdx}
                className={`mvp-gallery-thumb${i === mainIdx ? ' mvp-gallery-thumb--on' : ''}`}
                onClick={() => {
                  setMainIdx(i)
                  openFs(i)
                }}
              >
                <img src={String(p.photo_url)} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {fsOpen ? (
        <PhotoFullscreenViewer
          open={fsOpen}
          slides={slidesWithFallback}
          initialIndex={fsStart}
          onClose={() => setFsOpen(false)}
        />
      ) : null}
    </>
  )
}
