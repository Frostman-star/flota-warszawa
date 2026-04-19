import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * @param {string | null | undefined} vehicleId
 */
export function useVehiclePhotos(vehicleId) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!vehicleId) {
      setPhotos([])
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('vehicle_photos')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true })
    if (e) {
      setError(e.message)
      setPhotos([])
    } else {
      setPhotos(data ?? [])
    }
    setLoading(false)
  }, [vehicleId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { photos, loading, error, refresh }
}
