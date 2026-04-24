import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * @typedef {{ id: string, name: string, category: string, address: string, city: string, phone: string | null, google_maps_url: string | null, description: string | null, verified: boolean, rating_sum: number, rating_count: number }} ServiceRow
 */

/**
 * @param {{ city: string | null }} opts
 */
export function useServicesDirectory({ city }) {
  const [services, setServices] = useState([])
  const [reviewStats, setReviewStats] = useState(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase.from('services').select('*').order('name', { ascending: true })
      if (city) q = q.eq('city', city)
      const { data: rows, error: e1 } = await q
      if (e1) throw e1
      const list = Array.isArray(rows) ? rows : []
      setServices(list)

      if (list.length === 0) {
        setReviewStats(new Map())
        return
      }

      const ids = list.map((r) => r.id)
      const { data: revs, error: e2 } = await supabase
        .from('service_reviews')
        .select('service_id, rating')
        .in('service_id', ids)
      if (e2) throw e2
      /** @type {Map<string, { sum: number, count: number }>} */
      const m = new Map()
      for (const r of revs || []) {
        const sid = String(r.service_id)
        const rating = Number(r.rating)
        if (!Number.isFinite(rating)) continue
        const cur = m.get(sid) ?? { sum: 0, count: 0 }
        cur.sum += rating
        cur.count += 1
        m.set(sid, cur)
      }
      setReviewStats(m)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : String(err))
      setServices([])
      setReviewStats(new Map())
    } finally {
      setLoading(false)
    }
  }, [city])

  useEffect(() => {
    void load()
  }, [load])

  const enriched = useMemo(() => {
    return services
      .map((s) => {
      const sid = String(s.id)
      const agg = reviewStats.get(sid)
      const count = agg?.count ?? 0
      const sum = agg?.sum ?? 0
      const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : null
      return { ...s, _reviewCount: count, _avgRating: avg }
      })
      .sort((a, b) => {
        const aFeatured = a.plan_tier === 'featured' ? 1 : 0
        const bFeatured = b.plan_tier === 'featured' ? 1 : 0
        if (aFeatured !== bFeatured) return bFeatured - aFeatured
        return String(a.name || '').localeCompare(String(b.name || ''), 'pl')
      })
  }, [services, reviewStats])

  return { services: enriched, loading, error, refresh: load }
}
