import { useTranslation } from 'react-i18next'
import { tierForExpiry } from '../utils/documents'

/**
 * @param {{ tier?: import('../utils/documents').AlertTier | null, date?: string | null, className?: string }} props
 */
export function TierBadge({ tier: tierProp, date, className = '' }) {
  const { t } = useTranslation()
  const tier = tierProp ?? (date ? tierForExpiry(date) : null)
  if (!tier) return <span className={`tier-badge tier-none ${className}`}>{t('tierBadge.none')}</span>
  const label = t(`tierBadge.${tier}`)
  return (
    <span className={`tier-badge tier-${tier} ${className}`.trim()} title={label}>
      {label}
    </span>
  )
}
