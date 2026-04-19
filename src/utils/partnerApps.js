/** Canonical keys stored in cars.apps_available */
export const TAXI_APP_ORDER = ['uber', 'bolt', 'freenow', 'itaxi', 'indrive', 'other']

/** @param {unknown} raw */
export function normalizeAppsAvailable(raw) {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

/** @param {unknown} raw */
export function orderedAppIds(raw) {
  const set = new Set(normalizeAppsAvailable(raw))
  return TAXI_APP_ORDER.filter((id) => set.has(id))
}

/**
 * @param {unknown} raw
 * @param {(key: string) => string} t
 * @param {string} [sep]
 */
export function formatAppsReadable(raw, t, sep = ' · ') {
  return orderedAppIds(raw)
    .map((id) => t(`taxiApp.${id}`))
    .join(sep)
}

/** @param {string} id */
export function appPillClassName(id) {
  return `app-pill app-pill--${id}`
}

/**
 * @param {unknown} rawNames
 * @param {unknown} [legacySingleName]
 */
export function normalizePartnerNames(rawNames, legacySingleName) {
  const a = Array.isArray(rawNames) ? rawNames.map((x) => String(x).trim()).filter(Boolean) : []
  if (a.length) return a
  const leg = String(legacySingleName ?? '').trim()
  return leg ? [leg] : []
}

/**
 * @param {Record<string, unknown> | null | undefined} car
 * @param {string} [sep]
 */
export function formatPartnerNamesFromCar(car, sep = ' · ') {
  if (!car || typeof car !== 'object') return ''
  const c = /** @type {Record<string, unknown>} */ (car)
  return normalizePartnerNames(c.partner_names, c.partner_name).join(sep)
}
