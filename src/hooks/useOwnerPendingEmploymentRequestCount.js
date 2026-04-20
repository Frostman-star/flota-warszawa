import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * @param {string | null | undefined} ownerId
 * @param {boolean} [enabled]
 */
export function useOwnerPendingEmploymentRequestCount(ownerId, enabled = true) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled || !ownerId) {
      setCount(0)
      return
    }
    const { count: c, error } = await supabase
      .from('driver_employment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('status', 'pending_owner')
    if (error) {
      console.error(error)
      setCount(0)
      return
    }
    setCount(c ?? 0)
  }, [enabled, ownerId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { count, refresh }
}
