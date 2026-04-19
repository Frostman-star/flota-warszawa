import { useTranslation } from 'react-i18next'
import { appPillClassName, orderedAppIds } from '../utils/partnerApps'

/**
 * @param {{ apps: unknown, className?: string }} props
 */
export function AppPlatformPills({ apps, className = '' }) {
  const { t } = useTranslation()
  const ids = orderedAppIds(apps)
  if (!ids.length) return null
  return (
    <div className={`app-platform-pills${className ? ` ${className}` : ''}`.trim()} role="list" aria-label={t('legalPartner.availableApps')}>
      {ids.map((id) => (
        <span key={id} className={appPillClassName(id)} role="listitem">
          {t(`taxiApp.${id}`)}
        </span>
      ))}
    </div>
  )
}
