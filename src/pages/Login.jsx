import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, CircleUserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { normalizeProfileRole } from '../utils/profileRole'
import { supabase } from '../lib/supabase'

const PENDING_OWNER_REF_CODE_KEY = 'cario_owner_ref_code'

/** @param {string | null | undefined} profileRole */
function postLoginPath(profileRole, fromState) {
  const roleNorm = normalizeProfileRole(profileRole)
  const fallback = roleNorm === 'driver' ? '/marketplace' : roleNorm === 'service' ? '/service' : '/panel'
  if (!fromState || fromState === '/login') return fallback
  if (roleNorm === 'driver' && /^\/(panel|dodaj|flota|alerty|ustawienia|service)(\/|$)/.test(fromState)) return fallback
  if (roleNorm === 'service' && !/^\/service(\/|$)/.test(fromState)) return fallback
  return fromState
}

export function Login() {
  const { session, signIn, signUp, loading, role } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const target = useMemo(() => postLoginPath(role, location.state?.from), [role, location.state?.from])

  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login')
  const [registerRole, setRegisterRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (mode === 'login') setRegisterRole(null)
  }, [mode])
  useEffect(() => {
    const roleQ = searchParams.get('role')
    const refCode = searchParams.get('ref')
    if (searchParams.get('mode') === 'register') setMode('register')
    if (roleQ === 'driver' || roleQ === 'owner') setRegisterRole(roleQ)
    if (typeof window !== 'undefined' && refCode) {
      window.localStorage.setItem(PENDING_OWNER_REF_CODE_KEY, String(refCode).trim().toLowerCase())
    }
  }, [searchParams])

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
          setError(t('login.selectRoleFirst'))
          setBusy(false)
          return
        }
        const data = await signUp(email, password, fullName, registerRole)
        if (registerRole === 'owner' && data?.session && typeof window !== 'undefined') {
          const pendingCode = window.localStorage.getItem(PENDING_OWNER_REF_CODE_KEY)
          if (pendingCode) {
            await supabase.rpc('claim_owner_referral', { p_code: pendingCode })
          }
        }
        setInfo(data?.session ? t('login.accountCreated') : t('login.checkEmail'))
      }
    } catch (err) {
      setError(err.message ?? t('login.loginError'))
    } finally {
      setBusy(false)
    }
  }

  const showRegisterForm = mode === 'register' && registerRole
  const showAuthForm = mode === 'login' || showRegisterForm

  async function handleResetPassword(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      setInfo(t('login.resetSentSuccess'))
      setForgotOpen(false)
    } catch (err) {
      setError(err.message ?? t('login.loginError'))
    } finally {
      setBusy(false)
    }
  }

  async function signInSocial(provider) {
    setError(null)
    // NOTE: Enable Google, Apple, Facebook OAuth in Supabase Dashboard → Authentication → Providers
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) setError(oauthError.message)
  }

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
                  <Car />
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
                  <CircleUserRound />
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

        {showAuthForm ? (
          <>
            <div className="auth-social-stack">
              <button type="button" className="btn auth-social auth-social-google" onClick={() => void signInSocial('google')}>
                G {t('login.continueGoogle')}
              </button>
              <button type="button" className="btn auth-social auth-social-apple" onClick={() => void signInSocial('apple')}>
                🍎 {t('login.continueApple')}
              </button>
              <button
                type="button"
                className="btn auth-social auth-social-facebook"
                onClick={() => void signInSocial('facebook')}
              >
                f {t('login.continueFacebook')}
              </button>
            </div>
            <p className="auth-divider" aria-hidden>
              ━━━━ {t('login.orDivider')} ━━━━
            </p>
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
          </>
        ) : null}

        {mode === 'login' ? (
          <div className="auth-forgot-wrap">
            <button type="button" className="link link-button small" onClick={() => setForgotOpen((v) => !v)}>
              {t('login.forgotPasswordLink')}
            </button>
            {forgotOpen ? (
              <form className="auth-form" onSubmit={handleResetPassword}>
                <label className="field">
                  <span className="field-label">{t('login.email')}</span>
                  <input
                    className="input"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <button type="submit" className="btn secondary wide" disabled={busy}>
                  {busy ? t('login.processing') : t('login.sendResetLink')}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        <Link to="/" className="muted small link">{t('login.home')}</Link>
      </div>
    </div>
  )
}
