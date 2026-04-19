import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'

/** Drivers without an assigned car. Fleet owners/admins must never stay here (bookmark / old URL). */
export function NoCar() {
  const { t } = useTranslation()
  const { signOut, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="center-page">
        <LoadingSpinner />
      </div>
    )
  }

  if (isAdmin) {
    return <Navigate to="/panel" replace />
  }

  return (
    <div className="center-page narrow">
      <div className="card pad-lg">
        <h1>No assigned vehicle</h1>
        <p className="muted">
          Account <strong>{profile?.full_name ?? profile?.email}</strong> has no assigned car.
        </p>
        <button type="button" className="btn ghost" onClick={() => signOut()}>{t('app.logout')}</button>
      </div>
    </div>
  )
}
