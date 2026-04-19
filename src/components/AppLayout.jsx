import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LANG_OPTIONS } from '../i18n'
import { NotificationBell } from './NotificationBell'

/**
 * @param {{
 *   showNav?: boolean,
 *   outletContext?: Record<string, unknown> | null,
 *   notifCars?: Array<Record<string, unknown>>,
 *   extraTopLinkTo?: string | null,
 *   extraTopLinkLabel?: string,
 * }} props
 */
export function AppLayout({
  showNav = true,
  outletContext = null,
  notifCars = [],
  extraTopLinkTo = null,
  extraTopLinkLabel,
}) {
  const { profile, signOut, isAdmin } = useAuth()
  const { t, i18n } = useTranslation()
  const headerLinkTo = extraTopLinkTo ?? (showNav && isAdmin ? '/ustawienia' : null)
  const headerLinkLabel = extraTopLinkTo ? extraTopLinkLabel ?? t('app.settings') : t('app.settings')

  return (
    <div className="app-shell">
      <header className="topbar topbar-simple">
        <Link to={isAdmin ? '/panel' : '/'} className="brand brand-lockup">
          <span className="brand-icon" aria-hidden>
            C
          </span>
          <span className="brand-text-stack">
            <span className="brand-word">{t('app.brandName')}</span>
            <span className="brand-tagline muted small">{t('app.brandTagline')}</span>
          </span>
        </Link>
        {headerLinkTo ? (
          <Link to={headerLinkTo} className="topbar-settings-link muted small">
            {headerLinkLabel}
          </Link>
        ) : null}
        <div className="lang-switch" aria-label={t('app.language')}>
          {LANG_OPTIONS.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-flag${i18n.language === l.code ? ' active' : ''}`}
              onClick={() => i18n.changeLanguage(l.code)}
              aria-label={l.code}
            >
              {l.flag}
            </button>
          ))}
        </div>
        <NotificationBell cars={notifCars} />
        <div className="topbar-actions">
          <span className="user-chip muted small" title={profile?.email ?? ''}>
            {profile?.full_name ?? profile?.email ?? t('app.user')}
          </span>
          <button type="button" className="btn ghost small" onClick={() => signOut()}>
            {t('app.logout')}
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet context={outletContext ?? undefined} />
      </main>
    </div>
  )
}
