/**
 * Edge Function: notify-documents-cron
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *          VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (optional push),
 *          RESEND_API_KEY, RESEND_FROM_EMAIL (optional email),
 *          CRON_SECRET (required)
 *
 * Deploy: supabase functions deploy notify-documents-cron --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const DOC_LABELS: Record<string, string> = {
  insurance_expiry: 'OC/AC',
  przeglad_expiry: 'Przegląd techniczny',
}

function effectiveInsuranceExpiry(car: Record<string, unknown>): string | null {
  const ins = car.insurance_expiry
  if (typeof ins === 'string' && ins.trim()) return ins.trim()
  const oc = typeof car.oc_expiry === 'string' && car.oc_expiry.trim() ? car.oc_expiry.trim() : null
  const ac = typeof car.ac_expiry === 'string' && car.ac_expiry.trim() ? car.ac_expiry.trim() : null
  if (oc && ac) return oc < ac ? oc : ac
  return oc || ac
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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Cario <onboarding@resend.dev>'
    const cronSecret = Deno.env.get('CRON_SECRET')

    const incomingSecret = req.headers.get('x-cron-secret')
    if (!cronSecret || !incomingSecret || incomingSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized cron secret' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: prefRows, error: prefErr } = await admin
      .from('notification_preferences')
      .select('user_id, alert_days, email_enabled')
    if (prefErr) throw prefErr

    const { data: subRows, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
    if (subErr) throw subErr

    const users = new Set<string>()
    for (const p of prefRows ?? []) users.add(String(p.user_id))
    for (const s of subRows ?? []) users.add(String(s.user_id))
    const userIds = [...users]

    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, users: 0, sent: [] }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: profiles, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, email')
      .in('id', userIds)
    if (profileErr) throw profileErr

    const prefsByUser = new Map<string, { alert_days: number[] | null; email_enabled: boolean | null }>()
    for (const p of prefRows ?? []) {
      prefsByUser.set(String(p.user_id), {
        alert_days: (p.alert_days as number[] | null) ?? null,
        email_enabled: p.email_enabled ?? null,
      })
    }

    const subsByUser = new Map<string, Array<{ id: string; endpoint: string; p256dh: string; auth: string }>>()
    for (const s of subRows ?? []) {
      const uid = String(s.user_id)
      const list = subsByUser.get(uid) ?? []
      list.push({
        id: String(s.id),
        endpoint: String(s.endpoint),
        p256dh: String(s.p256dh),
        auth: String(s.auth),
      })
      subsByUser.set(uid, list)
    }

    const canPushGlobally = Boolean(vapidPublic && vapidPrivate)
    if (canPushGlobally) {
      webpush.setVapidDetails('mailto:flota@example.com', vapidPublic!, vapidPrivate!)
    }

    const sent: string[] = []
    const today = new Date().toISOString().slice(0, 10)

    for (const profile of profiles ?? []) {
      const userId = String(profile.id)
      const role = String(profile.role ?? '')
      const email = typeof profile.email === 'string' ? profile.email : ''
      const isAdmin = role === 'admin'

      const pref = prefsByUser.get(userId)
      const baseThresholds = pref?.alert_days?.length ? pref.alert_days : [30, 14, 7, 3, 1]
      const thresholds = [...new Set([...(baseThresholds ?? []), 0])]
      const emailEnabled = Boolean(pref?.email_enabled)

      let carsQuery = admin.from('cars').select('id, plate_number, insurance_expiry, oc_expiry, ac_expiry, przeglad_expiry, driver_id')
      if (!isAdmin) {
        carsQuery = carsQuery.eq('driver_id', userId)
      }
      const { data: cars, error: carsErr } = await carsQuery
      if (carsErr) throw carsErr

      const subs = subsByUser.get(userId) ?? []
      const canPushForUser = canPushGlobally && subs.length > 0

      for (const car of cars ?? []) {
        const plate = String((car as { plate_number?: string }).plate_number ?? '')
        const carId = (car as { id: string }).id
        const carRec = car as Record<string, unknown>
        const docChecks: Array<{ docKey: 'insurance_expiry' | 'przeglad_expiry'; raw: string }> = []

        const insEff = effectiveInsuranceExpiry(carRec)
        if (insEff) docChecks.push({ docKey: 'insurance_expiry', raw: insEff })
        const prz = carRec.przeglad_expiry
        if (typeof prz === 'string' && prz.trim()) docChecks.push({ docKey: 'przeglad_expiry', raw: prz.trim() })

        for (const { docKey, raw } of docChecks) {
          const days = daysUntilUtc(raw)
          if (days === null) continue

          const matchThreshold = thresholds.find((t) => t === days)
          if (matchThreshold === undefined) continue

          const label = DOC_LABELS[docKey] ?? docKey
          const title =
            days === 0
              ? `⚠️ ${plate} — ${label} wygasa dziś`
              : `⚠️ ${plate} — ${label} wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'}`
          const body = 'Sprawdź dokumenty auta'
          const docPath = isAdmin ? `/pojazd/${carId}` : `/samochod/${carId}`

          if (canPushForUser) {
            const { error: insErr } = await admin.from('notification_log').insert({
              user_id: userId,
              car_id: carId,
              doc_key: docKey,
              threshold_days: matchThreshold,
              channel: 'push',
              sent_on: today,
            })
            if (!insErr) {
              for (const sub of subs) {
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: sub.endpoint,
                      keys: { p256dh: sub.p256dh, auth: sub.auth },
                    } as webpush.PushSubscription,
                    JSON.stringify({
                      title,
                      body,
                      url: docPath,
                      type: 'document_expiry',
                      vehicle_id: carId,
                      doc_type: label,
                      days,
                    }),
                    { TTL: 86400 }
                  )
                  sent.push(`push:${userId}:${plate}:${docKey}:${matchThreshold}`)
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

          if (emailEnabled && resendKey && email) {
            const { error: insErr } = await admin.from('notification_log').insert({
              user_id: userId,
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
                  to: [email],
                  subject: title,
                  text: `${body}\n\nPojazd: ${plate}`,
                }),
              })
              if (r.ok) sent.push(`email:${userId}:${plate}:${docKey}:${matchThreshold}`)
              else console.error('Resend', await r.text())
            } else if (!isDuplicateKey(insErr)) {
              console.error(insErr)
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, users: userIds.length, sent }), {
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
