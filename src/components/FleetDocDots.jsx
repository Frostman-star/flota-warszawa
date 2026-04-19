import { useTranslation } from 'react-i18next'
import { tierForExpiry, tierForServiceDot } from '../utils/documents'

/**
 * @param {{ car: Record<string, unknown> }} props
 */
export function FleetDocDots({ car }) {
  const { t } = useTranslation()
  const keys = [
    { k: 'oc_expiry', label: 'OC', service: false },
    { k: 'ac_expiry', label: 'AC', service: false },
    { k: 'przeglad_expiry', label: t('fleetDoc.abbrPrz'), service: false },
    { k: 'last_service_date', label: t('fleetDoc.abbrSvc'), service: true },
  ]
  return (
    <div className="fleet-dots fleet-doc-dots-mobile" title={t('fleetDoc.legend')}>
      {keys.map(({ k, label, service }, idx) => {
        const date = car[k]
        const tier = service
          ? tierForServiceDot(typeof date === 'string' ? date : null)
          : tierForExpiry(typeof date === 'string' ? date : null)
        const cls = tier ? `tier-bg-${tier}` : 'doc-dot-none'
        return (
          <span key={k} className="fleet-doc-dot-item">
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
