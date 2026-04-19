import { useTranslation } from 'react-i18next'
import { effectiveInsuranceExpiryIso } from '../utils/carInsurance'
import { tierForExpiry, tierForServiceDot } from '../utils/documents'

/**
 * @param {{ car: Record<string, unknown> }} props
 */
export function FleetDocDots({ car }) {
  const { t } = useTranslation()
  const insDate = effectiveInsuranceExpiryIso(car)
  const keys = [
    { date: insDate, label: t('fleetDoc.abbrIns'), service: false },
    { date: car.przeglad_expiry, label: t('fleetDoc.abbrPrz'), service: false },
    { date: car.last_service_date, label: t('fleetDoc.abbrSvc'), service: true },
  ]
  return (
    <div className="fleet-dots fleet-doc-dots-mobile" title={t('fleetDoc.legend')}>
      {keys.map(({ date, label, service }, idx) => {
        const tier = service
          ? tierForServiceDot(typeof date === 'string' ? date : null)
          : tierForExpiry(typeof date === 'string' ? date : null)
        const cls = tier ? `tier-bg-${tier}` : 'doc-dot-none'
        return (
          <span key={`${label}-${idx}`} className="fleet-doc-dot-item">
            {idx > 0 ? (
              <span className="fleet-doc-dot-sep" aria-hidden="true">
                ·
              </span>
            ) : null}
            <span className="fleet-doc-dot-label">{label}</span>
            <span
              className={`fleet-dot ${cls}`}
              aria-label={`${label}: ${tier ?? t('fleetDoc.noTier')}`}
              title={`${label}: ${tier ?? t('fleetDoc.noDate')}`}
            />
          </span>
        )
      })}
    </div>
  )
}
