import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export function NoCar() {
  const { t } = useTranslation()
  const { signOut, profile } = useAuth()

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
