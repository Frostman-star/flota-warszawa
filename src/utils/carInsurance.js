/**
 * OC + AC merged: canonical DB column or earliest legacy expiry.
 * @param {Record<string, unknown>} car
 * @returns {string | null}
 */
export function effectiveInsuranceExpiryIso(car) {
  const ins = car.insurance_expiry
  if (typeof ins === 'string' && ins.trim()) return ins.trim()
  const oc = typeof car.oc_expiry === 'string' && car.oc_expiry.trim() ? car.oc_expiry.trim() : null
  const ac = typeof car.ac_expiry === 'string' && car.ac_expiry.trim() ? car.ac_expiry.trim() : null
  if (oc && ac) return oc < ac ? oc : ac
  return oc || ac
}

/**
 * Monthly insurance cost (OC+AC combined). Uses insurance_cost when present in row; else legacy sum.
 * @param {Record<string, unknown>} car
 */
export function monthlyInsuranceCostPln(car) {
  if ('insurance_cost' in car && car.insurance_cost != null && car.insurance_cost !== '') {
    const n = Number(car.insurance_cost)
    if (Number.isFinite(n)) return n
  }
  return Number(car.oc_cost ?? 0) + Number(car.ac_cost ?? 0)
}
