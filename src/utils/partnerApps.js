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
