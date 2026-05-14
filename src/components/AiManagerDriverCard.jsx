import { useState } from 'react'
import { MessageCircle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function initials(name) {
  const p = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase()
  if (p.length === 1 && p[0].length >= 2) return p[0].slice(0, 2).toUpperCase()
  if (p.length === 1) return p[0].slice(0, 1).toUpperCase()
  return '?'
}

/**
 * @param {{
 *   summary: { id: string; full_name?: string; car_plate?: string | null; car_model?: string | null; avatar_url?: string | null } | null
 *   animationDelayMs?: number
 *   onOpenChat: () => Promise<void>
 * }} props
 */
export function AiManagerDriverCard({ summary, animationDelayMs = 0, onOpenChat }) {
  const { t } = useTranslation()
  const [opening, setOpening] = useState(false)
  const name = summary?.full_name?.trim() || t('aiManager.driverCard.unknownName')
  const subtitle = [summary?.car_plate, summary?.car_model].filter(Boolean).join(' · ') || '—'
  const photoUrl = typeof summary?.avatar_url === 'string' && summary.avatar_url.trim() ? summary.avatar_url.trim() : ''

  async function onClick() {
    if (opening) return
    setOpening(true)
    try {
      await onOpenChat()
    } finally {
      setOpening(false)
    }
  }

  return (
    <button
      type="button"
      className="ai-driver-card"
      style={{ animationDelay: `${animationDelayMs}ms` }}
      onClick={() => void onClick()}
      disabled={opening}
      aria-label={t('aiManager.driverCard.openChatAria', { name })}
    >
      <div className="ai-driver-card__photo-wrap" aria-hidden>
        {photoUrl ? (
          <img src={photoUrl} alt="" className="ai-driver-card__photo" width={56} height={56} loading="lazy" />
        ) : (
          <div className="ai-driver-card__photo-placeholder">{initials(name)}</div>
        )}
      </div>
      <div className="ai-driver-card__body">
        <div className="ai-driver-card__row1">
          <span className="ai-driver-card__name">{name}</span>
          <span className="ai-driver-card__pill">
            <MessageCircle size={12} aria-hidden />
            {opening ? t('aiManager.driverCard.opening') : t('aiManager.driverCard.chat')}
          </span>
        </div>
        <div className="ai-driver-card__sub">
          <User size={12} aria-hidden className="ai-driver-card__icon" />
          {subtitle}
        </div>
        <div className="ai-driver-card__hint muted tiny">{t('aiManager.driverCard.tapHint')}</div>
      </div>
    </button>
  )
}
