import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LANG_OPTIONS } from '../i18n'

/**
 * @param {{
 *   showNav?: boolean,
 *   outletContext?: Record<string, unknown> | null,
 * }} props
 */
export function AppLayout({ showNav = true, outletContext = null }) {
  const { profile, signOut, isAdmin } = useAuth()
  const { t, i18n } = useTranslation()

  return (
    <div className="app-shell">
      <header className="topbar topbar-simple">
        <Link to={isAdmin ? '/panel' : '/'} className="brand">
          Flota <span className="brand-muted">Warszawa</span>
        </Link>
        {showNav && isAdmin ? (
          <Link to="/ustawienia" className="topbar-settings-link muted small">
            {t('app.settings')}
          </Link>
        ) : null}
        <div className="lang-switch" aria-label="Language switcher">
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
