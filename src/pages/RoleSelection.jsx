import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function RoleSelection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, refreshProfile, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!loading && !user) return <Navigate to="/login" replace />

  async function setRole(role) {
    if (!user?.id) return
    setBusy(true)
    setError('')
    const payload = {
      id: user.id,
      email: user.email ?? null,
      role,
      owner_id: role === 'owner' ? user.id : null,
    }
    const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (upErr) {
      setError(upErr.message)
      setBusy(false)
      return
    }
    await refreshProfile()
    setBusy(false)
    navigate(role === 'owner' ? '/panel' : '/marketplace', { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('roleSelection.title')}</h1>
        <p className="muted auth-lead">{t('roleSelection.lead')}</p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="auth-role-pick" role="group" aria-label={t('roleSelection.title')}>
          <button type="button" className="big-action big-action-primary" disabled={busy} onClick={() => void setRole('owner')}>
            <span className="big-action-emoji" aria-hidden>
              🚗
            </span>
            <span className="big-action-text">{t('roleSelection.owner')}</span>
          </button>
          <button type="button" className="big-action big-action-primary" disabled={busy} onClick={() => void setRole('driver')}>
            <span className="big-action-emoji" aria-hidden>
              👤
            </span>
            <span className="big-action-text">{t('roleSelection.driver')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
