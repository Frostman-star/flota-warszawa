import { useTranslation } from 'react-i18next'
import { carOperationalStatus } from '../utils/fleetMetrics'

/**
 * @param {{ car: Record<string, unknown> }} props
 */
export function CarStatusBadge({ car }) {
  const { t } = useTranslation()
  const s = carOperationalStatus(car)
  const label = t(`carStatus.${s}`)
  const hint = t(`carStatus.${s}Hint`)
  return (
    <span className={`status-badge status-${s}`} title={hint}>
      {label}
    </span>
  )
}
