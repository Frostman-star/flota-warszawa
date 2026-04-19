/** @param {unknown} ft */
export function fuelIcon(ft) {
  switch (String(ft || '').toLowerCase()) {
    case 'hybryda':
      return '🔋'
    case 'elektryczny':
      return '⚡'
    case 'gaz':
      return '💨'
    case 'diesel':
      return '⛽'
    default:
      return '⛽'
  }
}

/** @param {unknown} tr */
export function transmissionIcon(tr) {
  return String(tr || '').toLowerCase() === 'manualna' ? '⚙️' : '🅰️'
}

/** @param {Record<string, unknown>} car */
export function normalizeMarketplaceFeatures(car) {
  const f = car.marketplace_features
  if (!Array.isArray(f)) return []
  return f.map((x) => String(x))
}
