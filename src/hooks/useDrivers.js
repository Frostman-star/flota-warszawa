import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { shouldUseLegacyAssignedDriverColumn } from '../utils/carDriverSchema'

/**
 * Lista kierowców (profile z rolą driver) — tylko dla admina.
 * `assigned_to_car_id` — id auta, do którego kierowca jest przypisany (albo null).
 * @param {boolean} enabled
 * @param {string | null | undefined} fleetOwnerId — auth id właściciela floty (owner_id na profilach kierowców)
 */
export function useDrivers(enabled, fleetOwnerId) {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(!!enabled)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!enabled || !fleetOwnerId) {
      setDrivers([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let carsRes = await supabase
      .from('cars')
      .select('id, driver_id')
      .eq('owner_id', fleetOwnerId)
      .not('driver_id', 'is', null)
    if (carsRes.error && shouldUseLegacyAssignedDriverColumn(carsRes.error)) {
      carsRes = await supabase
        .from('cars')
        .select('id, assigned_driver_id')
        .eq('owner_id', fleetOwnerId)
        .not('assigned_driver_id', 'is', null)
    }

    const profRes = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'driver')
      .eq('owner_id', fleetOwnerId)
      .order('full_name', { ascending: true })

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

    const driverToCar = new Map()
    for (const row of carsRes.data ?? []) {
      const did = row.driver_id ?? row.assigned_driver_id
      if (did) driverToCar.set(String(did), String(row.id))
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
  }, [enabled, fleetOwnerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { drivers, loading, error, refresh }
}
