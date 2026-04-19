/**
 * Optional e-mail for driver application flow (Resend).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *          RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Deploy: supabase functions deploy notify-driver-application --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  event?: 'new_application' | 'accepted' | 'rejected'
  application_id?: string
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Cario <onboarding@resend.dev>'

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak Authorization' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Nieautoryzowany' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const body = (await req.json()) as Body
    const event = body.event
    const applicationId = String(body.application_id ?? '').trim()
    if (!event || !applicationId) {
      return new Response(JSON.stringify({ error: 'Wymagane event i application_id' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: appRow, error: appErr } = await admin
      .from('driver_applications')
      .select('id, owner_id, driver_id, car_id, status, driver_name, driver_phone, driver_message')
      .eq('id', applicationId)
      .maybeSingle()

    if (appErr || !appRow) {
      return new Response(JSON.stringify({ error: 'Nie znaleziono wniosku' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: car } = await admin.from('cars').select('plate_number, model').eq('id', appRow.car_id).maybeSingle()
    const plate = String(car?.plate_number ?? '—')

    const { data: ownerProf } = await admin.from('profiles').select('email, full_name').eq('id', appRow.owner_id).maybeSingle()
    const { data: driverProf } = await admin.from('profiles').select('email, full_name').eq('id', appRow.driver_id).maybeSingle()

    const ownerEmail = String(ownerProf?.email ?? '').trim()
    const driverEmail = String(driverProf?.email ?? '').trim()

    if (event === 'new_application') {
      if (user.id !== appRow.driver_id) {
        return new Response(JSON.stringify({ error: 'Brak uprawnień' }), {
          status: 403,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (!resendKey || !ownerEmail) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const subj = `Nowy wniosek kierowcy — ${plate}`
      const text = `Kierowca: ${appRow.driver_name ?? driverProf?.full_name ?? '—'}\nTelefon: ${appRow.driver_phone ?? '—'}\n\nWiadomość:\n${appRow.driver_message ?? '—'}\n\nZaloguj się do aplikacji Cario, aby przyjąć lub odrzucić wniosek.`
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: resendFrom, to: [ownerEmail], subject: subj, text }),
      })
      if (!r.ok) console.error('Resend', await r.text())
    } else if (event === 'accepted' || event === 'rejected') {
      if (user.id !== appRow.owner_id) {
        return new Response(JSON.stringify({ error: 'Brak uprawnień' }), {
          status: 403,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (!resendKey || !driverEmail) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const subj =
        event === 'accepted'
          ? `Zostałeś przyjęty do auta ${plate}`
          : `Wniosek na ${plate} został odrzucony`
      const text =
        event === 'accepted'
          ? `Gratulacje! Zostałeś przypisany do pojazdu ${plate} (${car?.model ?? ''}). Skontaktuj się z właścicielem floty.`
          : `Twój wniosek na pojazd ${plate} został odrzucony przez właściciela.`
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: resendFrom, to: [driverEmail], subject: subj, text }),
      })
      if (!r.ok) console.error('Resend', await r.text())
    } else {
      return new Response(JSON.stringify({ error: 'Nieznany event' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
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
