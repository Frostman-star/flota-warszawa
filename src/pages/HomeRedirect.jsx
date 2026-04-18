import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDriverCar } from '../hooks/useDriverCar'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function HomeRedirect() {
  const { session, loading, isAdmin, user } = useAuth()
  const { carId, loading: carLoading } = useDriverCar(user?.id)

  if (!loading && !session) {
    return <Navigate to="/login" replace />
  }

  if (loading || carLoading) {
    return (
      <div className="center-page">
        <LoadingSpinner />
      </div>
    )
  }

  if (isAdmin) {
    return <Navigate to="/panel" replace />
  }

  if (carId) {
    return <Navigate to={`/samochod/${carId}`} replace />
  }

  return <Navigate to="/brak-pojazdu" replace />
}
