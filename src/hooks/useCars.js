import { useCallback, useEffect, useState } from 'react'
import i18next from 'i18next'
import { supabase } from '../lib/supabase'

/**
 * @param {{ enabled?: boolean }} [opts]
 */
export function useCars(opts = {}) {
  const { enabled = true } = opts
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCars([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('cars')
      .select(
        `
        id,
        plate_number,
        model,
        year,
        color_label,
        driver_id,
        mileage_km,
        weekly_rent_pln,
        fines_count,
        oc_expiry,
        ac_expiry,
        przeglad_expiry,
        last_service_date,
        notes,
        created_at,
        updated_at,
        driver_label,
        show_in_marketplace,
        marketplace_status,
        driver_profile:profiles!cars_driver_id_fkey ( full_name )
      `
      )
      .order('plate_number', { ascending: true })

    if (qErr) {
      setError(qErr.message)
      setCars([])
    } else {
      setCars(
        (data ?? []).map((row) => ({
          ...row,
          driver_name: row.driver_profile?.full_name || (row.driver_label && String(row.driver_label).trim() ? row.driver_label : null),
        }))
      )
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { cars, loading, error, refresh }
}

/**
 * @param {string | null} carId
 * @param {{ userId?: string | null }} [opts]
 */
export function useCar(carId, opts = {}) {
  const { userId } = opts
  const [car, setCar] = useState(null)
  const [loading, setLoading] = useState(!!carId)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    if (!carId) {
      setCar(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let q = supabase
      .from('cars')
      .select(
        `
        id,
        plate_number,
        model,
        year,
        color_label,
        driver_id,
        mileage_km,
        weekly_rent_pln,
        fines_count,
        oc_expiry,
        ac_expiry,
        przeglad_expiry,
        last_service_date,
        notes,
        created_at,
        updated_at,
        driver_label,
        show_in_marketplace,
        marketplace_status,
        driver_profile:profiles!cars_driver_id_fkey ( full_name )
      `
      )
      .eq('id', carId)

    if (userId) {
      q = q.eq('driver_id', userId)
    }

    const { data, error: qErr } = await q.maybeSingle()

    if (qErr) {
      setError(qErr.message)
      setCar(null)
    } else if (!data) {
      setError(i18next.t('errors.carNotFound'))
      setCar(null)
    } else {
      setCar({
        ...data,
        driver_name: data.driver_profile?.full_name || (data.driver_label && String(data.driver_label).trim() ? data.driver_label : null),
      })
      setError(null)
    }
    setLoading(false)
  }, [carId, userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { car, loading, error, refresh }
}
