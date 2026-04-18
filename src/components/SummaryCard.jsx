export function SummaryCard({ title, value, hint, accent = 'default' }) {
  return (
    <article className={`summary-card accent-${accent}`}>
      <h3 className="summary-title">{title}</h3>
      <p className="summary-value">{value}</p>
      {hint ? <p className="summary-hint muted">{hint}</p> : null}
    </article>
  )
}
