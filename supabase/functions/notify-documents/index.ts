/**
 * Edge Function: notify-documents
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (optional push)
 * Optional: RESEND_API_KEY, RESEND_FROM_EMAIL
 *
 * Deploy: supabase functions deploy notify-documents --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DOC_LABELS: Record<string, string> = {
  oc_expiry: 'OC',
  ac_expiry: 'AC',
  przeglad_expiry: 'Przegląd techniczny',
}

function daysUntilUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const target = Date.UTC(y, mo, d)
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.ceil((target - today) / 86400000)
}

function isDuplicateKey(err: { code?: string; message?: string }) {
  return err.code === '23505' || String(err.message || '').toLowerCase().includes('duplicate')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Cario <onboarding@resend.dev>'

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak Authorization' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Nieautoryzowany' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: profile } = await userClient.from('profiles').select('role, email').eq('id', user.id).maybeSingle()
    const isAdmin = profile?.role === 'admin'

    let carsQuery = userClient.from('cars').select('id, plate_number, oc_expiry, ac_expiry, przeglad_expiry, driver_id')
    if (!isAdmin) {
      carsQuery = carsQuery.eq('driver_id', user.id)
    }
    const { data: cars, error: carsErr } = await carsQuery
    if (carsErr) throw carsErr

    const { data: prefs } = await userClient
      .from('notification_preferences')
      .select('alert_days, email_enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    const baseThresholds = (prefs?.alert_days as number[] | null) ?? [30, 14, 7, 3, 1]
    const thresholds = [...new Set([...baseThresholds, 0])].sort((a, b) => b - a)
    const emailEnabled = Boolean(prefs?.email_enabled)

    const { data: subs } = await userClient.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', user.id)

    const canPush = Boolean(vapidPublic && vapidPrivate && subs && subs.length > 0)
    if (canPush) {
      webpush.setVapidDetails('mailto:flota@example.com', vapidPublic!, vapidPrivate!)
    }

    const sent: string[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (const car of cars ?? []) {
      const plate = String((car as { plate_number?: string }).plate_number ?? '')
      const carId = (car as { id: string }).id

      for (const docKey of ['oc_expiry', 'ac_expiry', 'przeglad_expiry'] as const) {
        const raw = (car as Record<string, unknown>)[docKey]
        if (typeof raw !== 'string' || !raw) continue
        const days = daysUntilUtc(raw)
        if (days === null) continue

        const matchThreshold = thresholds.find((t) => t === days)
        if (matchThreshold === undefined) continue

        const label = DOC_LABELS[docKey] ?? docKey
        const title = `🚨 ${plate} — ${label}`
        const body =
          days === 0
            ? `${label} — ważność kończy się dziś!`
            : `${label} wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'}!`

        if (canPush) {
          const { error: insErr } = await admin.from('notification_log').insert({
            user_id: user.id,
            car_id: carId,
            doc_key: docKey,
            threshold_days: matchThreshold,
            channel: 'push',
            sent_on: today,
          })
          if (!insErr) {
            for (const sub of subs!) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  } as webpush.PushSubscription,
                  JSON.stringify({ title, body, url: `/flota/${carId}` }),
                  { TTL: 86400 }
                )
                sent.push(`push:${plate}:${docKey}:${matchThreshold}`)
              } catch (e: unknown) {
                const st = (e as { statusCode?: number })?.statusCode
                if (st === 404 || st === 410) {
                  await admin.from('push_subscriptions').delete().eq('id', sub.id)
                }
                console.error(e)
              }
            }
          } else if (!isDuplicateKey(insErr)) {
            console.error(insErr)
          }
        }

        if (emailEnabled && resendKey && user.email) {
          const { error: insErr } = await admin.from('notification_log').insert({
            user_id: user.id,
            car_id: carId,
            doc_key: docKey,
            threshold_days: matchThreshold,
            channel: 'email',
            sent_on: today,
          })
          if (!insErr) {
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: resendFrom,
                to: [user.email],
                subject: title,
                text: `${body}\n\nPojazd: ${plate}`,
              }),
            })
            if (r.ok) sent.push(`email:${plate}:${docKey}:${matchThreshold}`)
            else console.error('Resend', await r.text())
          } else if (!isDuplicateKey(insErr)) {
            console.error(insErr)
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
