import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('resetPassword.passwordTooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'))
      return
    }
    setBusy(true)
    const { error: upErr } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    navigate('/panel', { replace: true, state: { toast: t('resetPassword.changedToast') } })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('resetPassword.title')}</h1>
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">{t('resetPassword.newPassword')}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{t('resetPassword.confirmPassword')}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? t('app.loading') : t('resetPassword.submit')}
          </button>
        </form>
        <Link to="/login" className="link muted small">
          {t('resetPassword.backToLogin')}
        </Link>
      </div>
    </div>
  )
}
