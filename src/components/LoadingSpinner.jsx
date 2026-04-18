export function LoadingSpinner({ label = 'Ładowanie…' }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <span className="muted">{label}</span>
    </div>
  )
}
