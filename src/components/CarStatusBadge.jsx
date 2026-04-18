import { carOperationalStatus } from '../utils/fleetMetrics'

const COPY = {
  active: { label: 'W trasie', hint: 'Przypisany kierowca, dokumenty w porządku' },
  idle: { label: 'Bez kierowcy', hint: 'Pojazd nie jest przypisany' },
  alert: { label: 'Uwaga dokumenty', hint: 'Wymagana uwaga na terminy' },
}

/**
 * @param {{ car: Record<string, unknown> }} props
 */
export function CarStatusBadge({ car }) {
  const s = carOperationalStatus(car)
  const { label, hint } = COPY[s]
  return (
    <span className={`status-badge status-${s}`} title={hint}>
      {label}
    </span>
  )
}
