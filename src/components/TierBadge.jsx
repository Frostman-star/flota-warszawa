import { tierForExpiry } from '../utils/documents'

const LABELS = {
  red: 'pilne',
  orange: '7–14 dni',
  yellow: '14–30 dni',
  green: 'OK',
}

/**
 * @param {{ tier?: import('../utils/documents').AlertTier | null, date?: string | null, className?: string }} props
 */
export function TierBadge({ tier: tierProp, date, className = '' }) {
  const tier = tierProp ?? (date ? tierForExpiry(date) : null)
  if (!tier) return <span className={`tier-badge tier-none ${className}`}>brak daty</span>
  return (
    <span className={`tier-badge tier-${tier} ${className}`.trim()} title={LABELS[tier]}>
      {LABELS[tier]}
    </span>
  )
}
