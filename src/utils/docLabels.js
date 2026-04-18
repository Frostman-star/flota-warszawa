import { daysSince, daysUntil } from './documents'

/**
 * @param {string | null | undefined} isoDate
 * @returns {{ text: string, tone: 'ok' | 'warn' | 'danger' | 'muted' }}
 */
export function expiryStatusLabel(isoDate) {
  const d = daysUntil(isoDate)
  if (d === null) return { text: 'BRAK DATY', tone: 'muted' }
  if (d < 0) return { text: 'PRZETERMINOWANE', tone: 'danger' }
  if (d <= 7) return { text: 'PILNE', tone: 'danger' }
  if (d <= 30) return { text: `Za ${d} ${d === 1 ? 'dzień' : 'dni'}`, tone: 'warn' }
  return { text: 'OK', tone: 'ok' }
}

/** Im dłużej bez serwisu, tym ostrzej (dni od serwisu). */
export function serviceStatusLabel(isoDate) {
  const ds = daysSince(isoDate)
  if (ds === null) return { text: 'BRAK DATY', tone: 'muted' }
  if (ds > 730) return { text: 'PILNE', tone: 'danger' }
  if (ds > 365) return { text: 'SPRAWDŹ', tone: 'danger' }
  if (ds > 180) return { text: 'Za jakiś czas', tone: 'warn' }
  return { text: 'OK', tone: 'ok' }
}
