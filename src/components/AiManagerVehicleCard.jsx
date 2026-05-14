import { useMemo } from 'react'
import { Shield, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'

function parseDate(value) {
  if (!value || typeof value !== 'string') return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

function daysUntil(date) {
  if (!date) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const t = new Date(date)
  t.setHours(0, 0, 0, 0)
  return Math.ceil((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyTier(days) {
  if (days === null) return 'muted'
  if (days <= 7) return 'red'
  if (days <= 14) return 'orange'
  if (days <= 30) return 'yellow'
  return 'muted'
}

/**
 * @param {Record<string, unknown> | null | undefined} car
 * @param {(key: string, opts?: object) => string} t
 * @param {string} locale
 */
function pickUrgentDoc(car, t, locale) {
  if (!car) return { days: null, tier: 'muted', label: '', dateStr: '' }
  const candidates = []
  const ins = effectiveInsuranceExpiryIso(car)
  if (ins) {
    const d = parseDate(ins)
    if (d) candidates.push({ days: daysUntil(d), label: t('aiManager.vehicleCard.docLine.insurance'), date: d })
  }
  const prz = car.przeglad_expiry
  if (typeof prz === 'string' && prz.trim()) {
    const d = parseDate(prz)
    if (d) candidates.push({ days: daysUntil(d), label: t('aiManager.vehicleCard.docLine.inspection'), date: d })
  }
  const withDays = candidates.filter((c) => c.days !== null)
  if (!withDays.length) return { days: null, tier: 'muted', label: '', dateStr: '' }
  withDays.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
  const best = withDays[0]
  const tier = urgencyTier(best.days)
  const dateStr = new Intl.DateTimeFormat(locale).format(best.date)
  return { days: best.days, tier, label: best.label, dateStr }
}

function plateInitials(plate) {
  const p = String(plate ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (p.length >= 2) return p.slice(0, 2)
  if (p.length === 1) return `${p}·`
  return '?'
}

/**
 * @param {{
 *   car: Record<string, unknown> | null | undefined
 *   vehicleId: string
 *   onOpen: () => void
 *   animationDelayMs?: number
 * }} props
 */
export function AiManagerVehicleCard({ car, vehicleId, onOpen, animationDelayMs = 0 }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage || i18n.language || 'pl'

  const doc = useMemo(() => pickUrgentDoc(car, t, locale), [car, t, locale])
  const badgeTier = urgencyTier(doc.days)
  const driverName = car?.driver_name ? String(car.driver_name) : ''
  const plate = car?.plate_number ? String(car.plate_number) : vehicleId.slice(0, 8)
  const modelYear = [car?.model, car?.year].filter(Boolean).join(' ') || '—'

  const photoUrl = typeof car?.primary_photo_url === 'string' && car.primary_photo_url.trim() ? car.primary_photo_url.trim() : ''

  const badgeText =
    doc.days === null
      ? '—'
      : doc.days === 0
        ? t('aiManager.vehicleCard.today')
        : doc.days < 0
          ? t('aiManager.vehicleCard.overdue', { days: Math.abs(doc.days) })
          : t('aiManager.vehicleCard.daysLeft', { count: doc.days })

  return (
    <button
      type="button"
      className={`ai-vehicle-card ai-vehicle-card--tier-${badgeTier}`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
      onClick={onOpen}
      aria-label={t('aiManager.vehicleCard.openAria', { plate })}
    >
      <div className="ai-vehicle-card__photo-wrap" aria-hidden>
        {photoUrl ? (
          <img src={photoUrl} alt="" className="ai-vehicle-card__photo" width={56} height={56} loading="lazy" />
        ) : (
          <div className="ai-vehicle-card__photo-placeholder">{plateInitials(plate)}</div>
        )}
      </div>
      <div className="ai-vehicle-card__body">
        <div className="ai-vehicle-card__row1">
          <span className="ai-vehicle-card__plate">{plate}</span>
          <span className={`ai-vehicle-card__badge ai-vehicle-card__badge--${badgeTier}`}>{badgeText}</span>
        </div>
        <div className="ai-vehicle-card__model">{modelYear}</div>
        <div className={`ai-vehicle-card__driver ${driverName ? '' : 'ai-vehicle-card__driver--empty'}`}>
          <User size={12} aria-hidden className="ai-vehicle-card__icon" />
          {driverName || t('aiManager.vehicleCard.noDriver')}
        </div>
        <div className={`ai-vehicle-card__doc ai-vehicle-card__doc--${doc.tier}`}>
          <Shield size={12} aria-hidden className="ai-vehicle-card__icon" />
          {doc.label && doc.dateStr ? (
            <span>
              {doc.label} {t('aiManager.vehicleCard.docUntil')} {doc.dateStr}
            </span>
          ) : (
            <span>{t('aiManager.vehicleCard.noDocDates')}</span>
          )}
        </div>
      </div>
    </button>
  )
}
