import i18next from 'i18next'
import { daysUntil } from './documents'

/**
 * @param {Record<string, unknown>} car
 * @param {number[]} thresholds
 */
export function collectDocRemindersForCar(car, thresholds) {
  const plate = String(car.plate_number ?? '')
  const carId = String(car.id ?? '')
  const set = new Set([...thresholds, 0])
  /** @type {Array<{ carId: string, plate: string, docKey: string, label: string, days: number, threshold: number }>} */
  const out = []
  for (const docKey of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
    const date = car[docKey]
    if (typeof date !== 'string' || !date) continue
    const days = daysUntil(date)
    if (days === null) continue
    const th = [...set].find((t) => t === days)
    if (th === undefined) continue
    out.push({
      carId,
      plate,
      docKey,
      label: i18next.t(`docs.${docKey}`, { defaultValue: docKey }),
      days,
      threshold: th,
    })
  }
  return out
}

/**
 * @param {Array<Record<string, unknown>>} cars
 * @param {number[]} thresholds
 */
export function collectAllDocReminders(cars, thresholds) {
  const list = []
  for (const car of cars) {
    list.push(...collectDocRemindersForCar(car, thresholds))
  }
  return list
}

export function localDedupeKey(r) {
  const d = new Date().toISOString().slice(0, 10)
  return `flota_local_${d}_${r.carId}_${r.docKey}_${r.threshold}`
}

export function formatReminderBody(plate, label, days) {
  if (days === 0) return `🚨 ${plate} — ${label}: ważność kończy się dziś!`
  return `🚨 ${plate} — ${label} wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'}!`
}
