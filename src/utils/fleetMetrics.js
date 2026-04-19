import i18next from 'i18next'
import { daysUntil, flattenDocumentAlerts, isUrgentExpiry, worstDocumentTier } from './documents'

export function computeWeeklyRentTotal(cars) {
  return cars.reduce((sum, c) => sum + Number(c.weekly_rent_pln ?? 0), 0)
}
export function countActiveCars(cars) { return cars.filter((c) => c.assigned_driver_id).length }
export function countCarsWithoutDriver(cars) { return cars.filter((c) => !c.assigned_driver_id).length }
export function countUrgentDocumentAlerts(cars) {
  let n = 0
  for (const car of cars) for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) if (typeof car[key] === 'string' && isUrgentExpiry(car[key])) n += 1
  return n
}
export function monthlyRentForecast(cars) { return computeWeeklyRentTotal(cars) * 4 }
export function countNewCarsWithoutDriverThisWeek(cars) {
  const weekAgo = Date.now() - 7 * 86400000
  return cars.filter((c) => !c.assigned_driver_id && (c.created_at ? new Date(String(c.created_at)).getTime() : 0) >= weekAgo).length
}
export function countBellAlerts(cars) { return cars.reduce((n, car) => n + flattenDocumentAlerts(car).length, 0) }
export function buildAlertRows(cars) {
  const rows = []
  for (const car of cars) {
    const plate = String(car.plate_number ?? '')
    const id = String(car.id ?? '')
    for (const a of flattenDocumentAlerts(car)) rows.push({ carId: id, plate, docKey: a.key, docLabel: a.label, date: a.date, days: a.days, tier: a.tier })
  }
  rows.sort((a, b) => a.days - b.days)
  return rows
}
export function carOperationalStatus(car) {
  if (!car.assigned_driver_id) return 'idle'
  const w = worstDocumentTier(car)
  if (w === 'red' || w === 'orange' || w === 'yellow') return 'alert'
  return 'active'
}
export function formatDaysLabel(iso) {
  const d = daysUntil(iso)
  if (d === null) return i18next.t('docDays.missing')
  if (d < 0) return i18next.t('docDays.expired', { count: Math.abs(d) })
  if (d === 0) return i18next.t('docDays.today')
  if (d === 1) return i18next.t('docDays.one')
  return i18next.t('docDays.inDays', { count: d })
}
