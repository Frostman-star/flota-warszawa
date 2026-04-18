import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { collectAllDocReminders, formatReminderBody, localDedupeKey } from '../utils/remindersClient'

/**
 * Przy każdym załadowaniu: wywołanie Edge Function (push/e-mail po stronie serwera)
 * oraz lokalne powiadomienia przeglądarki (gdy włączone), z deduplikacją w sessionStorage.
 * @param {{ cars: Array<Record<string, unknown>> }} props
 */
export function RemindersBootstrap({ cars }) {
  const { session } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!session?.access_token || !cars?.length) return

    let cancelled = false

    ;(async () => {
      const edgeKey = `flota_edge_notify_${new Date().toISOString().slice(0, 10)}`
      if (!sessionStorage.getItem(edgeKey)) {
        sessionStorage.setItem(edgeKey, '1')
        try {
          await supabase.functions.invoke('notify-documents', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        } catch {
          /* brak wdrożonej funkcji — ignoruj */
        }
      }

      if (cancelled) return

      let thresholds = [30, 14, 7, 3, 1]
      try {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('alert_days')
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (prefs?.alert_days?.length) thresholds = prefs.alert_days
      } catch {
        /* brak tabeli — domyślne progi */
      }

      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      const reminders = collectAllDocReminders(cars, thresholds)
      for (const r of reminders) {
        const key = localDedupeKey(r)
        if (sessionStorage.getItem(key)) continue
        sessionStorage.setItem(key, '1')
        try {
          new Notification(`🚨 ${r.plate} — ${r.label}`, {
            body: formatReminderBody(r.plate, r.label, r.days),
            icon: '/favicon.svg',
          })
        } catch {
          /* */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.access_token, session?.user?.id, cars, pathname])

  return null
}
