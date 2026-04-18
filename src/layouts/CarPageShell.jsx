import { Outlet } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'

/**
 * @param {{ nestInAdminLayout?: boolean }} props
 * Gdy nestInAdminLayout — renderuje tylko <Outlet /> (nagłówek z AdminLayout).
 */
export function CarPageShell({ nestInAdminLayout = false }) {
  const { isAdmin } = useAuth()

  if (nestInAdminLayout) {
    return <Outlet />
  }

  return <AppLayout showNav={isAdmin} />
}
