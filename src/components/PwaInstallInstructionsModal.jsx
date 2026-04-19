import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { isIosUserAgent } from '../utils/pwaInstallDetection'

export function PwaInstallInstructionsModal({ open, onClose }) {
  const { t } = useTranslation()
  const ios = isIosUserAgent()
  const keys = ios
    ? ['pwaInstall.settings.iosStep1', 'pwaInstall.settings.iosStep2', 'pwaInstall.settings.iosStep3', 'pwaInstall.settings.iosStep4']
    : [
        'pwaInstall.settings.androidStep1',
        'pwaInstall.settings.androidStep2',
        'pwaInstall.settings.androidStep3',
        'pwaInstall.settings.androidStep4',
      ]

  return (
    <Modal open={open} title={t('pwaInstall.settings.modalTitle')} onClose={onClose}>
      <ol className="pwa-install-steps">
        {keys.map((key, i) => (
          <li key={key} className="pwa-install-step">
            <span className="pwa-install-step-num" aria-hidden>
              {i + 1}
            </span>
            <span className="pwa-install-step-text">{t(key)}</span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
