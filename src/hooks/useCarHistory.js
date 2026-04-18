import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * @param {string | null} carId
 */
export function useCarHistory(carId) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const carIdRef = useRef(carId)
  carIdRef.current = carId

  const refresh = useCallback(async () => {
    const id = carIdRef.current
    if (!id) {
      setEntries([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('car_history')
        .select('id, car_id, event_type, previous_mileage, new_mileage, detail, created_at, service_type, cost_pln')
        .eq('car_id', id)
        .order('created_at', { ascending: false })

      if (carIdRef.current !== id) return

      if (qErr) {
        setError(qErr.message)
        setEntries([])
      } else {
        setEntries(data ?? [])
      }
    } finally {
      if (carIdRef.current === id) setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [carId, refresh])

  return { entries, loading, error, refresh }
}
