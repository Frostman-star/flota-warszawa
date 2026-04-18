import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Lista kierowców (profile z rolą driver) — tylko dla admina.
 */
export function useDrivers(enabled) {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(!!enabled)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setDrivers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'driver')
      .order('full_name', { ascending: true })

    if (qErr) {
      setError(qErr.message)
      setDrivers([])
    } else {
      setDrivers(data ?? [])
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { drivers, loading, error, refresh }
}
