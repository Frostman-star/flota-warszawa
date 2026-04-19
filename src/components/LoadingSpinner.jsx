import { useTranslation } from 'react-i18next'

export function LoadingSpinner({ label }) {
  const { t } = useTranslation()
  const text = label ?? t('app.loading')

  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <span className="muted">{text}</span>
    </div>
  )
}
