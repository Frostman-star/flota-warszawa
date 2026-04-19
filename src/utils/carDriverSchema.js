/**
 * Сумісність БД: до міграції — `assigned_driver_id`, після — `driver_id`.
 * PostgREST: embed без `!constraint_name`, щоб не ламалося при різних назвах FK у кеші схеми.
 */

/** @param {unknown} row */
export function normalizeCarRow(row) {
  if (!row || typeof row !== 'object') return row
  const r = /** @type {Record<string, unknown>} */ (row)
  const driver_id = r.driver_id ?? r.assigned_driver_id ?? null
  const { assigned_driver_id: _a, ...rest } = r
  return {
    ...rest,
    driver_id,
    driver_name:
      (r.driver_profile && typeof r.driver_profile === 'object' && r.driver_profile.full_name) ||
      (r.driver_label && String(r.driver_label).trim() ? r.driver_label : null),
  }
}

/** @param {{ message?: string } | null | undefined} err */
export function shouldUseLegacyAssignedDriverColumn(err) {
  if (!err) return false
  const m = String(err.message || '').toLowerCase()
  const rel = m.includes('relationship') && m.includes('cars') && m.includes('profiles')
  const missingCol =
    m.includes('driver_id') && (m.includes('column') || m.includes('does not exist') || m.includes('schema cache'))
  return rel || missingCol || m.includes('cars_driver_id_fkey')
}

/** @param {Record<string, unknown>} payload */
export function toLegacyCarWritePayload(payload) {
  const next = { ...payload }
  if ('driver_id' in next) {
    next.assigned_driver_id = next.driver_id
    delete next.driver_id
  }
  return next
}
