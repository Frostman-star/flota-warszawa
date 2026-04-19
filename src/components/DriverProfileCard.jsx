import { useTranslation } from 'react-i18next'
import { driverAgeYears, polandStatusBadgeTone } from '../utils/driverProfile'

/**
 * @param {{
 *   profile: Record<string, unknown> | null | undefined,
 *   showDocVerified?: boolean,
 *   className?: string,
 * }} props
 */
export function DriverProfileCard({ profile, showDocVerified = false, className = '' }) {
  const { t } = useTranslation()
  const name = String(profile?.full_name ?? '').trim() || '—'
  const bio = String(profile?.bio ?? '').trim()
  const exp = profile?.experience_years != null ? Number(profile.experience_years) : null
  const expOk = exp != null && !Number.isNaN(exp)
  const gender = String(profile?.gender ?? '').trim()
  const age = driverAgeYears(profile?.birth_year != null ? Number(profile.birth_year) : null)
  const poland = String(profile?.poland_status ?? '').trim()
  const tone = polandStatusBadgeTone(poland)
  const avatar = String(profile?.avatar_url ?? '').trim()

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <article className={`driver-profile-card ${className}`.trim()}>
      <div className="driver-profile-card-head">
        {avatar ? (
          <img src={avatar} alt="" className="driver-profile-card-avatar" />
        ) : (
          <div className="driver-profile-card-avatar driver-profile-card-avatar--ph" aria-hidden>
            {initials || '?'}
          </div>
        )}
        <div className="driver-profile-card-head-text">
          <h3 className="driver-profile-card-name">{name}</h3>
          <p className="driver-profile-card-meta muted small">
            {age != null ? t('driverProfile.ageDisplay', { age }) : null}
            {age != null && gender ? ' · ' : null}
            {gender ? t(`driverProfile.gender.${gender}`) : null}
            {age == null && !gender ? '—' : null}
            {showDocVerified && String(profile?.poland_status_doc_url ?? '').trim() ? (
              <span className="driver-profile-doc-check" title={t('driverProfile.docVerifiedTitle')}>
                {' '}
                ✓
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="driver-profile-card-badges">
        {expOk ? <span className="exp-badge">{t('ownerApplications.expBadge', { n: exp })}</span> : null}
        {poland ? (
          <span className={`driver-poland-badge driver-poland-badge--${tone}`}>{t(`driverProfile.polandStatus.${poland}`)}</span>
        ) : null}
      </div>
      {bio ? <p className="driver-profile-card-bio muted small">{bio}</p> : null}
    </article>
  )
}
