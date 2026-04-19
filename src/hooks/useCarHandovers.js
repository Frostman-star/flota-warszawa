import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * @param {string | null} carId
 * @param {boolean} enabled
 */
export function useCarHandovers(carId, enabled) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!carId || !enabled) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const { data: h, error } = await supabase
        .from('car_handovers')
        .select('id, handover_type, handover_date, driver_name_snapshot, created_at')
        .eq('car_id', carId)
        .order('handover_date', { ascending: false })
      if (error) throw error
      const list = h ?? []
      const ids = list.map((r) => r.id)
      let counts = {}
      if (ids.length) {
        const { data: photos, error: pe } = await supabase.from('handover_photos').select('handover_id').in('handover_id', ids)
        if (pe) throw pe
        for (const p of photos ?? []) {
          counts[p.handover_id] = (counts[p.handover_id] ?? 0) + 1
        }
      }
      setRows(list.map((r) => ({ ...r, photoCount: counts[r.id] ?? 0 })))
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [carId, enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, refresh }
}

/**
 * @param {string | null} handoverId
 * @param {boolean} open
 */
export function useHandoverPhotos(handoverId, open) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !handoverId) {
      setPhotos([])
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('handover_photos')
      .select('id, photo_url, angle, created_at')
      .eq('handover_id', handoverId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error(error)
          setPhotos([])
        } else {
          setPhotos(data ?? [])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [handoverId, open])

  return { photos, loading }
}
