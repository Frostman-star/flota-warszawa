import { Link, useLocation } from 'react-router-dom'

export function MobileBottomNav() {
  const { pathname } = useLocation()

  const item = (to, label, opts = {}) => {
    const active = opts.exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
    return (
      <Link to={to} className={`mob-nav-item${active ? ' active' : ''}`}>
        {label}
      </Link>
    )
  }

  return (
    <nav className="mob-nav" aria-label="Nawigacja mobilna">
      {item('/panel', '🏠 Panel', { exact: true })}
      {item('/flota', '🚗 Auta')}
      <Link to="/dodaj" className={`mob-nav-item${pathname === '/dodaj' ? ' active' : ''}`}>
        ➕ Dodaj
      </Link>
      {item('/alerty', '🔔 Alerty')}
    </nav>
  )
}
