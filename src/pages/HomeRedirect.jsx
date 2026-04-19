import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { normalizeProfileRole } from '../utils/profileRole'

export function HomeRedirect() {
  const { session, loading, role } = useAuth()
  const roleNorm = normalizeProfileRole(role)

  if (!loading && !session) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="center-page">
        <LoadingSpinner />
      </div>
    )
  }

  if (roleNorm === 'driver') {
    return <Navigate to="/marketplace" replace />
  }

  return <Navigate to="/panel" replace />
}
