/**
 * Normalizes `profiles.role` from PostgREST (enum → string) for safe comparisons.
 * @param {unknown} role
 * @returns {string} lowercase trimmed, or '' if missing
 */
export function normalizeProfileRole(role) {
  if (role == null) return ''
  const s = typeof role === 'string' ? role : String(role)
  return s.trim().toLowerCase()
}
