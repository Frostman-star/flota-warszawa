import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * @param {{
 *   showNav?: boolean,
 *   outletContext?: Record<string, unknown> | null,
 * }} props
 */
export function AppLayout({ showNav = true, outletContext = null }) {
  const { profile, signOut, isAdmin } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar topbar-simple">
        <Link to={isAdmin ? '/panel' : '/'} className="brand">
          Flota <span className="brand-muted">Warszawa</span>
        </Link>
        {showNav && isAdmin ? (
          <Link to="/ustawienia" className="topbar-settings-link muted small">
            Ustawienia
          </Link>
        ) : null}
        <div className="topbar-actions">
          <span className="user-chip muted small" title={profile?.email ?? ''}>
            {profile?.full_name ?? profile?.email ?? 'Użytkownik'}
          </span>
          <button type="button" className="btn ghost small" onClick={() => signOut()}>
            Wyloguj
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet context={outletContext ?? undefined} />
      </main>
    </div>
  )
}
