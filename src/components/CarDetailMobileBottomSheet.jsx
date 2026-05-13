import { useEffect } from 'react'

/**
 * @param {{ open: boolean, title: string, closeLabel: string, onClose: () => void, children: import('react').ReactNode, footer?: import('react').ReactNode }} props
 */
export function CarDetailMobileBottomSheet({ open, title, closeLabel, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="car-mobile-sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="car-mobile-sheet-backdrop" aria-label={closeLabel} onClick={onClose} />
      <section className="car-mobile-sheet">
        <button type="button" className="car-mobile-sheet-handle" aria-label={closeLabel} onClick={onClose} />
        <header className="car-mobile-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="car-mobile-sheet-close" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </header>
        <div className="car-mobile-sheet-body">{children}</div>
        {footer ? <footer className="car-mobile-sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
