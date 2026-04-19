import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function HomeRedirect() {
  const { session, loading, role } = useAuth()
  const roleLower = String(role ?? '').toLowerCase()

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

  if (roleLower === 'driver') {
    return <Navigate to="/marketplace" replace />
  }

  return <Navigate to="/panel" replace />
}
