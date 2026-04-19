import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Lista kierowców (profile z rolą driver) — tylko dla admina.
 * `assigned_to_car_id` — id auta, do którego kierowca jest przypisany (albo null).
 * @param {boolean} enabled
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
    const [profRes, carsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'driver').order('full_name', { ascending: true }),
      supabase.from('cars').select('id, driver_id').not('driver_id', 'is', null),
    ])

    if (profRes.error) {
      setError(profRes.error.message)
      setDrivers([])
      setLoading(false)
      return
    }
    if (carsRes.error) {
      setError(carsRes.error.message)
      setDrivers([])
      setLoading(false)
      return
    }

    /** @type {Map<string, string>} */
    const driverToCar = new Map()
    for (const row of carsRes.data ?? []) {
      if (row.driver_id) driverToCar.set(String(row.driver_id), String(row.id))
    }

    setDrivers(
      (profRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email ?? null,
        assigned_to_car_id: driverToCar.get(String(p.id)) ?? null,
      }))
    )
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { drivers, loading, error, refresh }
}
