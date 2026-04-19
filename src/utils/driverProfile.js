/** @typedef {'male' | 'female' | ''} DriverGender */

export const POLAND_STATUS_KEYS = /** @type {const} */ ([
  'karta_pobytu',
  'eu_passport',
  'visa',
  'work_permit',
  'other',
])

/**
 * @param {string | null | undefined} status
 */
export function polandStatusBadgeTone(status) {
  const s = String(status || '')
  if (s === 'eu_passport') return 'eu'
  if (s === 'karta_pobytu') return 'karta'
  if (s === 'visa') return 'visa'
  if (s === 'work_permit') return 'work'
  return 'other'
}

/**
 * @param {{
 *   full_name?: string | null,
 *   phone?: string | null,
 *   experience_years?: number | null,
 *   bio?: string | null,
 *   gender?: string | null,
 *   birth_year?: number | null,
 *   poland_status?: string | null,
 *   poland_status_doc_url?: string | null,
 *   avatar_url?: string | null,
 * } | null | undefined} profile
 */
export function driverProfileProgressPercent(profile) {
  let ok = 0
  const total = 8
  if (String(profile?.full_name ?? '').trim()) ok += 1
  if (String(profile?.phone ?? '').trim()) ok += 1
  if (profile?.experience_years != null && !Number.isNaN(Number(profile.experience_years))) ok += 1
  if (String(profile?.gender ?? '').trim()) ok += 1
  const by = profile?.birth_year
  if (by != null && Number.isFinite(Number(by)) && Number(by) >= 1940 && Number(by) <= new Date().getFullYear()) ok += 1
  if (String(profile?.poland_status ?? '').trim()) ok += 1
  if (String(profile?.poland_status_doc_url ?? '').trim()) ok += 1
  if (String(profile?.avatar_url ?? '').trim()) ok += 1
  return Math.min(100, Math.round((ok / total) * 100))
}

/**
 * @param {{
 *   full_name?: string | null,
 *   phone?: string | null,
 *   experience_years?: number | null,
 *   gender?: string | null,
 *   birth_year?: number | null,
 *   poland_status?: string | null,
 *   poland_status_doc_url?: string | null,
 *   avatar_url?: string | null,
 * } | null | undefined} profile
 */
export function isDriverProfileCompleteForApply(profile) {
  return driverProfileProgressPercent(profile) >= 100
}

/**
 * @param {number | null | undefined} birthYear
 */
export function driverAgeYears(birthYear) {
  if (birthYear == null || !Number.isFinite(Number(birthYear))) return null
  const y = Number(birthYear)
  const now = new Date().getFullYear()
  if (y < 1940 || y > now) return null
  return now - y
}
