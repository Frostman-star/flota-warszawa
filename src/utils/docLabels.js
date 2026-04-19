import i18next from 'i18next'
import { daysSince, daysUntil } from './documents'

/**
 * @param {string | null | undefined} isoDate
 * @returns {{ text: string, tone: 'ok' | 'warn' | 'danger' | 'muted' }}
 */
export function expiryStatusLabel(isoDate) {
  const d = daysUntil(isoDate)
  if (d === null) return { text: i18next.t('docStatus.noDate'), tone: 'muted' }
  if (d < 0) return { text: i18next.t('docStatus.expired'), tone: 'danger' }
  if (d <= 7) return { text: i18next.t('docStatus.urgent'), tone: 'danger' }
  if (d <= 30) return { text: d === 1 ? i18next.t('docStatus.inOneDay') : i18next.t('docStatus.inDays', { count: d }), tone: 'warn' }
  return { text: i18next.t('docStatus.ok'), tone: 'ok' }
}

/** Im dłużej bez serwisu, tym ostrzej (dni od serwisu). */
export function serviceStatusLabel(isoDate) {
  const ds = daysSince(isoDate)
  if (ds === null) return { text: i18next.t('serviceStatus.noDate'), tone: 'muted' }
  if (ds > 730) return { text: i18next.t('serviceStatus.urgent'), tone: 'danger' }
  if (ds > 365) return { text: i18next.t('serviceStatus.checkSoon'), tone: 'danger' }
  if (ds > 180) return { text: i18next.t('serviceStatus.later'), tone: 'warn' }
  return { text: i18next.t('serviceStatus.ok'), tone: 'ok' }
}
