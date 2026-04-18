import {
  daysUntil,
  flattenDocumentAlerts,
  isUrgentExpiry,
  worstDocumentTier,
} from './documents'

/**
 * @param {Array<Record<string, unknown>>} cars
 */
export function computeWeeklyRentTotal(cars) {
  return cars.reduce((sum, c) => sum + Number(c.weekly_rent_pln ?? 0), 0)
}

/**
 * @param {Array<Record<string, unknown>>} cars
 */
export function countActiveCars(cars) {
  return cars.filter((c) => c.assigned_driver_id).length
}

/**
 * @param {Array<Record<string, unknown>>} cars
 */
export function countCarsWithoutDriver(cars) {
  return cars.filter((c) => !c.assigned_driver_id).length
}

/**
 * Pilne alerty dokumentów (czerwony / pomarańczowy) — unikalne pozycje dokumentów.
 * @param {Array<Record<string, unknown>>} cars
 */
export function countUrgentDocumentAlerts(cars) {
  let n = 0
  for (const car of cars) {
    for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
      const date = car[key]
      if (typeof date === 'string' && isUrgentExpiry(date)) n += 1
    }
  }
  return n
}

/**
 * Wszystkie dokumenty w oknie 30 dni (dla dzwonka i panelu).
 * @param {Array<Record<string, unknown>>} cars
 */
export function monthlyRentForecast(cars) {
  return computeWeeklyRentTotal(cars) * 4
}

/** Auta bez kierowcy utworzone w ciągu ostatnich 7 dni (nowe „idle”). */
export function countNewCarsWithoutDriverThisWeek(cars) {
  const weekAgo = Date.now() - 7 * 86400000
  return cars.filter((c) => {
    if (c.assigned_driver_id) return false
    const created = c.created_at ? new Date(String(c.created_at)).getTime() : 0
    return created >= weekAgo
  }).length
}

export function countBellAlerts(cars) {
  let n = 0
  for (const car of cars) {
    n += flattenDocumentAlerts(car).length
  }
  return n
}

/**
 * @param {Array<Record<string, unknown>>} cars
 */
export function buildAlertRows(cars) {
  /** @type {Array<{ carId: string, plate: string, docKey: string, docLabel: string, date: string, days: number, tier: import('./documents').AlertTier }>} */
  const rows = []
  for (const car of cars) {
    const plate = String(car.plate_number ?? '')
    const id = String(car.id ?? '')
    for (const a of flattenDocumentAlerts(car)) {
      rows.push({
        carId: id,
        plate,
        docKey: a.key,
        docLabel: a.label,
        date: a.date,
        days: a.days,
        tier: a.tier,
      })
    }
  }
  rows.sort((a, b) => a.days - b.days)
  return rows
}

/**
 * @param {Record<string, unknown>} car
 */
export function carOperationalStatus(car) {
  if (!car.assigned_driver_id) return 'idle'
  const w = worstDocumentTier(car)
  if (w === 'red' || w === 'orange' || w === 'yellow') return 'alert'
  return 'active'
}

/**
 * @param {string | null | undefined} iso
 */
export function formatDaysLabel(iso) {
  const d = daysUntil(iso)
  if (d === null) return '—'
  if (d < 0) return `przeterminowane (${d} d.)`
  if (d === 0) return 'dziś'
  if (d === 1) return '1 dzień'
  return `${d} dni`
}
