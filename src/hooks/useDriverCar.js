import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { shouldUseLegacyAssignedDriverColumn } from '../utils/carDriverSchema'

/**
 * Pojazd przypisany do zalogowanego kierowcy (pierwszy znaleziony).
 * @param {string | null | undefined} userId
 */
export function useDriverCar(userId) {
  const [carId, setCarId] = useState(null)
  const [loading, setLoading] = useState(!!userId)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCarId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let { data, error: qErr } = await supabase
      .from('cars')
      .select('id')
      .eq('driver_id', userId)
      .order('plate_number', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (qErr && shouldUseLegacyAssignedDriverColumn(qErr)) {
      const r2 = await supabase
        .from('cars')
        .select('id')
        .eq('assigned_driver_id', userId)
        .order('plate_number', { ascending: true })
        .limit(1)
        .maybeSingle()
      data = r2.data
      qErr = r2.error
    }

    if (qErr) {
      setError(qErr.message)
      setCarId(null)
    } else {
      setCarId(data?.id ?? null)
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { carId, loading, error, refresh }
}
