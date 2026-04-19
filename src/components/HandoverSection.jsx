import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCarHandovers } from '../hooks/useCarHandovers'
import { HandoverWizard } from './HandoverWizard'
import { HandoverGalleryModal } from './HandoverGalleryModal'
import { localeTag } from '../utils/localeTag'

/**
 * @param {{ car: Record<string, unknown>, user: { id: string } | null | undefined }} props
 */
export function HandoverSection({ car, user }) {
  const { t, i18n } = useTranslation()
  const lc = localeTag(i18n.resolvedLanguage ?? i18n.language)
  const carId = String(car.id ?? '')
  const ownerId = user?.id ?? ''
  const { rows, loading, refresh } = useCarHandovers(carId, Boolean(ownerId))
  const [wizardOpen, setWizardOpen] = useState(false)
  const [galleryId, setGalleryId] = useState(/** @type {string | null} */ (null))

  return (
    <section id="car-handover" className="detail-block handover-section">
      <h2>{t('handover.sectionTitle')}</h2>
      <p className="muted small">{t('handover.sectionLead')}</p>
      <button type="button" className="btn btn-huge primary handover-new-btn" onClick={() => setWizardOpen(true)}>
        {t('handover.newProtocol')}
      </button>

      <h3 className="handover-history-heading">{t('handover.historyTitle')}</h3>
      {loading ? (
        <p className="muted small">{t('app.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="muted small">{t('handover.historyEmpty')}</p>
      ) : (
        <ul className="handover-history-list">
          {rows.map((row) => (
            <li key={row.id} className="handover-history-item">
              <div className="handover-history-main">
                <p className="handover-history-date">{new Date(row.handover_date).toLocaleString(lc)}</p>
                <span className={`handover-badge handover-badge--${row.handover_type}`}>
                  {row.handover_type === 'pickup' ? t('handover.badgePickupShort') : t('handover.badgeReturnShort')}
                </span>
                <p className="muted small handover-history-driver">
                  {row.driver_name_snapshot?.trim() || '—'}
                </p>
                <p className="handover-history-count">{t('handover.photoCount', { count: row.photoCount })}</p>
              </div>
              <button type="button" className="btn secondary handover-view-btn" onClick={() => setGalleryId(row.id)}>
                {t('handover.viewPhotos')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <HandoverWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        car={{
          id: carId,
          driver_id: car.driver_id ?? null,
          driver_name: car.driver_name ?? null,
        }}
        ownerId={ownerId}
        onSaved={() => refresh()}
      />
      <HandoverGalleryModal open={Boolean(galleryId)} handoverId={galleryId} onClose={() => setGalleryId(null)} />
    </section>
  )
}
