import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { normalizeProfileRole } from '../utils/profileRole'

/** @param {string | null | undefined} profileRole */
function postLoginPath(profileRole, fromState) {
  const roleNorm = normalizeProfileRole(profileRole)
  const fallback = roleNorm === 'driver' ? '/marketplace' : '/panel'
  if (!fromState || fromState === '/login') return fallback
  if (roleNorm === 'driver' && /^\/(panel|dodaj|flota|alerty|ustawienia)(\/|$)/.test(fromState)) return fallback
  return fromState
}

export function Login() {
  const { session, signIn, signUp, loading, role } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const target = useMemo(() => postLoginPath(role, location.state?.from), [role, location.state?.from])

  const [mode, setMode] = useState('login')
  const [registerRole, setRegisterRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (mode === 'login') setRegisterRole(null)
  }, [mode])

  if (!loading && session) return <Navigate to={target} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        if (!registerRole) {
          setError('Select account type first.')
          setBusy(false)
          return
        }
        const data = await signUp(email, password, fullName, registerRole)
        setInfo(data?.session ? 'Account created.' : 'Check your e-mail inbox for confirmation.')
      }
    } catch (err) {
      setError(err.message ?? 'Login error')
    } finally {
      setBusy(false)
    }
  }

  const showRegisterForm = mode === 'register' && registerRole

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t('login.title')}</h1>
        <p className="muted auth-lead">{t('login.lead')}</p>

        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>
            {t('login.tabLogin')}
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('register')
              setRegisterRole(null)
            }}
          >
            {t('login.tabRegister')}
          </button>
        </div>

        {mode === 'register' ? (
          <div className="auth-register-step">
            <p className="auth-role-hint muted small">{t('login.pickRole')}</p>
            <div className="auth-role-pick" role="group" aria-label={t('login.pickRole')}>
              <button
                type="button"
                className={['big-action', registerRole === 'owner' ? 'big-action-primary is-role-selected' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={registerRole === 'owner'}
                onClick={() => setRegisterRole('owner')}
              >
                <span className="big-action-emoji" aria-hidden>
                  🚗
                </span>
                <span className="big-action-text">{t('login.owner')}</span>
              </button>
              <button
                type="button"
                className={['big-action', registerRole === 'driver' ? 'big-action-primary is-role-selected' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={registerRole === 'driver'}
                onClick={() => setRegisterRole('driver')}
              >
                <span className="big-action-emoji" aria-hidden>
                  👤
                </span>
                <span className="big-action-text">{t('login.driver')}</span>
              </button>
            </div>
          </div>
        ) : null}

        {showRegisterForm ? (
          <p className="muted small auth-role-change">
            <button type="button" className="link link-button" onClick={() => setRegisterRole(null)}>
              {t('login.changeType')}
            </button>
          </p>
        ) : null}

        {mode === 'login' || showRegisterForm ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="field">
                <span className="field-label">{t('login.fullName')}</span>
                <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
              </label>
            ) : null}
            <label className="field">
              <span className="field-label">{t('login.email')}</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label className="field">
              <span className="field-label">{t('login.password')}</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {info ? <p className="form-info">{info}</p> : null}
            <button type="submit" className="btn primary wide" disabled={busy}>
              {busy ? t('login.processing') : mode === 'login' ? t('login.submitLogin') : t('login.submitRegister')}
            </button>
          </form>
        ) : null}

        <Link to="/" className="muted small link">{t('login.home')}</Link>
      </div>
    </div>
  )
}
