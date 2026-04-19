import { useMemo, useState, useEffect } from 'react'
import { useVehiclePhotos } from '../hooks/useVehiclePhotos'
import { PhotoFullscreenViewer } from './PhotoFullscreenViewer'

const ORDER = [
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

/**
 * @param {{ carId: string | null, fallbackUrl?: string | null, onClose: () => void }} props
 */
export function MarketplaceCarPhotoZoom({ carId, fallbackUrl = null, onClose }) {
  const { photos, loading } = useVehiclePhotos(carId)
  const [open, setOpen] = useState(true)

  const slides = useMemo(() => {
    const list = [...photos]
    list.sort(
      (a, b) =>
        ORDER.indexOf(String(a.angle_key)) - ORDER.indexOf(String(b.angle_key)) ||
        String(a.created_at).localeCompare(String(b.created_at))
    )
    const mapped = list
      .filter((p) => p.photo_url)
      .map((p) => ({
        id: String(p.id ?? ''),
        url: String(p.photo_url),
        angleKey: String(p.angle_key ?? ''),
      }))
    if (mapped.length) return mapped
    const fb = String(fallbackUrl ?? '').trim()
    if (fb) return [{ url: fb, angleKey: 'front_left' }]
    return []
  }, [photos, fallbackUrl])

  useEffect(() => {
    if (!loading && slides.length === 0) {
      onClose()
    }
  }, [loading, slides.length, onClose])

  if (!carId || (!loading && slides.length === 0)) return null

  return (
    <PhotoFullscreenViewer
      open={open && slides.length > 0}
      slides={slides}
      initialIndex={0}
      onClose={() => {
        setOpen(false)
        onClose()
      }}
    />
  )
}
