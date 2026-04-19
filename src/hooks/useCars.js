import { useCallback, useEffect, useState } from 'react'
import i18next from 'i18next'
import { supabase } from '../lib/supabase'
import { normalizeCarRow, shouldUseLegacyAssignedDriverColumn } from '../utils/carDriverSchema'

const CAR_EMBED = 'driver_profile:profiles ( full_name )'

const CAR_SELECT_NEW = `
        id,
        plate_number,
        model,
        year,
        color_label,
        driver_id,
        mileage_km,
        weekly_rent_pln,
        oc_cost,
        ac_cost,
        insurance_cost,
        service_cost,
        other_costs,
        fines_count,
        oc_expiry,
        ac_expiry,
        insurance_expiry,
        przeglad_expiry,
        last_service_date,
        notes,
        created_at,
        updated_at,
        driver_label,
        show_in_marketplace,
        marketplace_status,
        marketplace_listed,
        marketplace_photo_url,
        primary_photo_url,
        marketplace_description,
        marketplace_location,
        deposit_amount,
        fuel_type,
        transmission,
        seats,
        consumption,
        marketplace_features,
        min_driver_age,
        min_experience_years,
        min_rental_months,
        owner_phone,
        owner_telegram,
        partner_names,
        partner_name,
        partner_contact,
        apps_available,
        registration_city,
        owner_id,
        ${CAR_EMBED}
      `

/** Columns safe for non-owners (marketplace / assigned driver read-only). No costs, mileage, notes, or internal doc dates. */
const CAR_SELECT_PUBLIC = `
        id,
        plate_number,
        model,
        year,
        weekly_rent_pln,
        marketplace_photo_url,
        primary_photo_url,
        marketplace_description,
        marketplace_location,
        marketplace_status,
        marketplace_listed,
        show_in_marketplace,
        deposit_amount,
        fuel_type,
        transmission,
        seats,
        consumption,
        marketplace_features,
        min_driver_age,
        min_experience_years,
        min_rental_months,
        owner_phone,
        owner_telegram,
        partner_names,
        partner_name,
        partner_contact,
        apps_available,
        registration_city,
        driver_id,
        driver_label,
        ${CAR_EMBED}
      `

const CAR_SELECT_PUBLIC_LEGACY = `
        id,
        plate_number,
        model,
        year,
        weekly_rent_pln,
        marketplace_photo_url,
        primary_photo_url,
        marketplace_description,
        marketplace_location,
        marketplace_status,
        marketplace_listed,
        show_in_marketplace,
        deposit_amount,
        fuel_type,
        transmission,
        seats,
        consumption,
        marketplace_features,
        min_driver_age,
        min_experience_years,
        min_rental_months,
        owner_phone,
        owner_telegram,
        partner_names,
        partner_name,
        partner_contact,
        apps_available,
        registration_city,
        assigned_driver_id,
        driver_label,
        ${CAR_EMBED}
      `

const CAR_SELECT_LEGACY = `
        id,
        plate_number,
        model,
        year,
        color_label,
        assigned_driver_id,
        mileage_km,
        weekly_rent_pln,
        oc_cost,
        ac_cost,
        insurance_cost,
        service_cost,
        other_costs,
        fines_count,
        oc_expiry,
        ac_expiry,
        insurance_expiry,
        przeglad_expiry,
        last_service_date,
        notes,
        created_at,
        updated_at,
        driver_label,
        show_in_marketplace,
        marketplace_status,
        marketplace_listed,
        marketplace_photo_url,
        primary_photo_url,
        marketplace_description,
        marketplace_location,
        deposit_amount,
        fuel_type,
        transmission,
        seats,
        consumption,
        marketplace_features,
        min_driver_age,
        min_experience_years,
        min_rental_months,
        owner_phone,
        owner_telegram,
        partner_names,
        partner_name,
        partner_contact,
        apps_available,
        registration_city,
        owner_id,
        ${CAR_EMBED}
      `

/**
 * @param {{ enabled?: boolean, ownerId?: string | null }} [opts]
 */
export function useCars(opts = {}) {
  const { enabled = true, ownerId = null } = opts
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
    let q = supabase.from('cars').select(CAR_SELECT_NEW).order('plate_number', { ascending: true })
    if (ownerId) q = q.eq('owner_id', ownerId)
    let { data, error: qErr } = await q

    if (qErr && shouldUseLegacyAssignedDriverColumn(qErr)) {
      let r2q = supabase.from('cars').select(CAR_SELECT_LEGACY).order('plate_number', { ascending: true })
      if (ownerId) r2q = r2q.eq('owner_id', ownerId)
      const r2 = await r2q
      data = r2.data
      qErr = r2.error
    }

    if (qErr) {
      setError(qErr.message)
      setCars([])
    } else {
      setCars((data ?? []).map((row) => normalizeCarRow(row)))
    }
    setLoading(false)
  }, [enabled, ownerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { cars, loading, error, refresh }
}

/**
 * @param {string | null} carId
 * @param {{ userId?: string | null, ownerId?: string | null }} [opts]
 */
export function useCar(carId, opts = {}) {
  const { userId, ownerId } = opts
  const usePublicSelect = Boolean(userId && !ownerId)
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

    async function fetchOne(selectStr, driverEqKey) {
      let q = supabase.from('cars').select(selectStr).eq('id', carId)
      if (userId) q = q.eq(driverEqKey, userId)
      if (ownerId) q = q.eq('owner_id', ownerId)
      return q.maybeSingle()
    }

    const selectNew = usePublicSelect ? CAR_SELECT_PUBLIC : CAR_SELECT_NEW
    const selectLegacy = usePublicSelect ? CAR_SELECT_PUBLIC_LEGACY : CAR_SELECT_LEGACY

    let { data, error: qErr } = await fetchOne(selectNew, 'driver_id')

    if (qErr && shouldUseLegacyAssignedDriverColumn(qErr)) {
      const r2 = await fetchOne(selectLegacy, 'assigned_driver_id')
      data = r2.data
      qErr = r2.error
    }

    if (qErr) {
      setError(qErr.message)
      setCar(null)
    } else if (!data) {
      setError(i18next.t('errors.carNotFound'))
      setCar(null)
    } else {
      setCar(normalizeCarRow(data))
      setError(null)
    }
    setLoading(false)
  }, [carId, userId, ownerId, usePublicSelect])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { car, loading, error, refresh }
}
