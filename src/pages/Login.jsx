import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { session, signIn, signUp, loading, isAdmin } = useAuth()
  const location = useLocation()
  const from = location.state?.from || (isAdmin ? '/panel' : '/')

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)

  if (!loading && session) {
    return <Navigate to={from === '/login' ? '/' : from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        const data = await signUp(email, password, fullName)
        if (data?.session) {
          setInfo('Konto utworzone. Możesz się zalogować.')
        } else {
          setInfo('Sprawdź skrzynkę e-mail, aby potwierdzić konto (jeśli włączone w Supabase).')
        }
      }
    } catch (err) {
      setError(err.message ?? 'Błąd logowania')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Flota Warszawa</h1>
        <p className="muted auth-lead">Zarządzanie taksówkami — zaloguj się, aby kontynuować.</p>
        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            Logowanie
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            Rejestracja
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <label className="field">
              <span className="field-label">Imię i nazwisko</span>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}
          <label className="field">
            <span className="field-label">E-mail</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Hasło</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {info ? <p className="form-info">{info}</p> : null}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? 'Przetwarzanie…' : mode === 'login' ? 'Zaloguj' : 'Utwórz konto'}
          </button>
        </form>
        <p className="muted small auth-foot">
          Po pierwszej rejestracji nadaj rolę <strong>admin</strong> w Supabase:{' '}
          <code>update public.profiles set role = &apos;admin&apos; where email = &apos;…&apos;;</code>
        </p>
        <Link to="/" className="muted small link">
          Strona główna
        </Link>
      </div>
    </div>
  )
}
