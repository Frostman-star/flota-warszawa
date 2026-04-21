import { useMarketplaceViewPing } from '../hooks/useMarketplaceViewPing'

/**
 * Catalog card shell: attaches view ping when listing is shown (IntersectionObserver + session dedupe).
 * @param {{ carId: string; pingEnabled: boolean; onViewRecorded?: (id: string) => void; className?: string; children: import('react').ReactNode }} props
 */
export function MarketplaceListedCarArticle({ carId, pingEnabled, onViewRecorded, className, children }) {
  const ref = useMarketplaceViewPing(carId, pingEnabled, { onRecorded: onViewRecorded })
  return (
    <article ref={ref} className={className}>
      {children}
    </article>
  )
}
