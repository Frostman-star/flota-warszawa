import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_PREFIX = 'cario_mvv1_'

/**
 * One server-side marketplace view ping per browser session per car, when the card is meaningfully visible.
 * @param {string | null | undefined} carId
 * @param {boolean} enabled
 * @param {{ onRecorded?: (id: string) => void }} [opts]
 */
export function useMarketplaceViewPing(carId, enabled, opts) {
  const onRecordedRef = useRef(opts?.onRecorded)
  onRecordedRef.current = opts?.onRecorded
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled || !carId) return undefined
    const id = String(carId)
    let cancelled = false

    const markSeen = () => {
      try {
        sessionStorage.setItem(STORAGE_PREFIX + id, '1')
      } catch {
        /* ignore */
      }
    }

    let already = false
    try {
      already = Boolean(sessionStorage.getItem(STORAGE_PREFIX + id))
    } catch {
      already = false
    }
    if (already) return undefined

    const fire = async () => {
      const { data, error } = await supabase.rpc('increment_car_marketplace_view', { p_car_id: id })
      if (cancelled) return
      if (!error) {
        markSeen()
        if (Number(data) > 0) onRecordedRef.current?.(id)
      }
    }

    const el = ref.current
    if (!el) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      void fire()
      return () => {
        cancelled = true
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting && en.intersectionRatio >= 0.3) {
            io.disconnect()
            void fire()
            break
          }
        }
      },
      { threshold: [0.3, 0.55] }
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [carId, enabled])

  return ref
}
