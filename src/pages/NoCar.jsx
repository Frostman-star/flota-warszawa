import { useAuth } from '../context/AuthContext'

export function NoCar() {
  const { signOut, profile } = useAuth()

  return (
    <div className="center-page narrow">
      <div className="card pad-lg">
        <h1>Brak przypisanego pojazdu</h1>
        <p className="muted">
          Konto <strong>{profile?.full_name ?? profile?.email}</strong> nie ma przypisanego samochodu w flocie.
          Skontaktuj się z administratorem floty.
        </p>
        <button type="button" className="btn ghost" onClick={() => signOut()}>
          Wyloguj
        </button>
      </div>
    </div>
  )
}
