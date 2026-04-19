import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Current car where auth user is assigned as driver (driver_id).
 */
export function useDriverAssignedCar(userId, enabled = true) {
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled && userId))
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!userId || !enabled) {
      setAssignment(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: car, error: carErr } = await supabase
        .from('cars')
        .select(
          'id, plate_number, model, year, weekly_rent_pln, partner_names, registration_city, owner_id'
        )
        .eq('driver_id', userId)
        .maybeSingle()
      if (carErr) throw carErr
      if (!car?.id) {
        setAssignment(null)
        return
      }
      let ownerName = null
      if (car.owner_id) {
        const { data: owner, error: ownerErr } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', car.owner_id)
          .maybeSingle()
        if (ownerErr) throw ownerErr
        ownerName = owner?.full_name != null ? String(owner.full_name).trim() : null
      }
      setAssignment({
        carId: car.id,
        plate: car.plate_number != null ? String(car.plate_number) : '—',
        model: car.model != null ? String(car.model) : '',
        year: car.year,
        weeklyRentPln: car.weekly_rent_pln,
        partnerNames: Array.isArray(car.partner_names) ? car.partner_names : [],
        registrationCity: car.registration_city != null ? String(car.registration_city) : '',
        ownerName: ownerName || '—',
      })
    } catch (e) {
      console.error('[useDriverAssignedCar]', e)
      setError(e?.message ?? String(e))
      setAssignment(null)
    } finally {
      setLoading(false)
    }
  }, [userId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { assignment, loading, error, refresh }
}
