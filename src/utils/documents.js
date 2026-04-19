import i18next from 'i18next'

/** @typedef {'red' | 'orange' | 'yellow' | 'green'} AlertTier */

const MS_PER_DAY = 86400000

/**
 * Liczy pełne dni kalendarzowe do daty (lokalnie). Ujemne = przeterminowane.
 * @param {string | null | undefined} isoDate YYYY-MM-DD
 * @returns {number | null}
 */
export function daysUntil(isoDate) {
  if (!isoDate) return null
  const target = parseLocalDate(isoDate)
  if (!target) return null
  const today = startOfLocalDay(new Date())
  return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY)
}

/**
 * @param {string | null | undefined} isoDate
 * @returns {AlertTier | null}
 */
export function tierForExpiry(isoDate) {
  const d = daysUntil(isoDate)
  if (d === null) return null
  if (d < 0 || d < 7) return 'red'
  if (d < 14) return 'orange'
  if (d < 30) return 'yellow'
  return 'green'
}

/**
 * Dokumenty w panelu alertów: wygasają w ciągu 30 dni (włącznie z dniem 30).
 * @param {string | null | undefined} isoDate
 */
export function isWithinAlertWindow(isoDate) {
  const d = daysUntil(isoDate)
  return d !== null && d <= 30
}

/**
 * Pilne (czerwony + pomarańczowy) dla karty podsumowania.
 * @param {string | null | undefined} isoDate
 */
export function isUrgentExpiry(isoDate) {
  const t = tierForExpiry(isoDate)
  return t === 'red' || t === 'orange'
}

/**
 * @param {string | null | undefined} isoDate
 */
export function parseLocalDate(isoDate) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * @param {Record<string, unknown>} car
 * @returns {Array<{ key: string, label: string, date: string, days: number, tier: AlertTier }>}
 */
export function flattenDocumentAlerts(car) {
  /** @type {Array<{ key: string, label: string, date: string, days: number, tier: AlertTier }>} */
  const out = []
  const keys = ['oc_expiry', 'ac_expiry', 'przeglad_expiry']
  for (const key of keys) {
    const date = car[key]
    if (typeof date !== 'string' || !date) continue
    const days = daysUntil(date)
    if (days === null) continue
    if (!isWithinAlertWindow(date)) continue
    const tier = tierForExpiry(date) ?? 'yellow'
    out.push({
      key,
      label: i18next.t(`docs.${key}`),
      date,
      days,
      tier,
    })
  }
  return out
}

/**
 * Najgorszy tier spośród dokumentów (do wiersza listy).
 * @param {Record<string, unknown>} car
 * @returns {AlertTier | null}
 */
export function worstDocumentTier(car) {
  const order = { red: 0, orange: 1, yellow: 2, green: 3 }
  let best = null
  for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
    const date = car[key]
    const tier = tierForExpiry(typeof date === 'string' ? date : null)
    if (!tier) continue
    if (best === null || order[tier] < order[best]) best = tier
  }
  return best
}

/** Dni od daty serwisu (dodatnie = ile dni temu). */
export function daysSince(isoDate) {
  if (!isoDate) return null
  const t = parseLocalDate(isoDate)
  if (!t) return null
  const today = startOfLocalDay(new Date())
  return Math.floor((today.getTime() - t.getTime()) / MS_PER_DAY)
}

/**
 * Kropka „Serwis” w liście floty: im starszy serwis, tym ostrzejszy kolor.
 * @param {string | null | undefined} isoDate
 * @returns {AlertTier | null}
 */
export function tierForServiceDot(isoDate) {
  const ds = daysSince(isoDate)
  if (ds === null) return null
  if (ds > 730) return 'red'
  if (ds > 365) return 'orange'
  if (ds > 180) return 'yellow'
  return 'green'
}

/**
 * Filtr „Pilne”: dowolny dokument (OC/AC/przegląd) ≤14 dni lub przeterminowany.
 * @param {Record<string, unknown>} car
 */
export function isPilne14(car) {
  for (const key of ['oc_expiry', 'ac_expiry', 'przeglad_expiry']) {
    const d = daysUntil(car[key])
    if (d !== null && d <= 14) return true
  }
  return false
}

/**
 * Filtr „OK”: wszystkie trzy terminy zielone lub brak daty problemowej.
 * @param {Record<string, unknown>} car
 */
export function isFleetOk(car) {
  if (!car.assigned_driver_id) return false
  const w = worstDocumentTier(car)
  return w === 'green' || w === null
}

const TIER_RANK = { red: 0, orange: 1, yellow: 2, green: 3 }

/** Niższy = pilniejszy. Brak daty = 99. */
export function tierRank(tier) {
  if (!tier) return 99
  return TIER_RANK[tier] ?? 99
}
