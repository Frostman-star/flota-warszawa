/**
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Deploy: supabase functions deploy remove-driver --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Brak Authorization' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } } })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Nieautoryzowany' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role as string | undefined
    if (role !== 'admin' && role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Tylko właściciel floty lub admin' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const body = (await req.json()) as { user_id?: string }
    const targetId = String(body.user_id ?? '')
    if (!targetId || targetId === user.id) {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy user_id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: targetProfile, error: targetErr } = await admin.from('profiles').select('id, role, owner_id').eq('id', targetId).maybeSingle()
    if (targetErr) throw targetErr
    if (!targetProfile || targetProfile.role !== 'driver') {
      return new Response(JSON.stringify({ error: 'Nie znaleziono kierowcy' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
    if (String(targetProfile.owner_id ?? '') !== user.id) {
      return new Response(JSON.stringify({ error: 'Brak uprawnień do tego kierowcy' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    await admin.from('cars').update({ driver_id: null }).eq('driver_id', targetId).eq('owner_id', user.id)

    const { error } = await admin.auth.admin.deleteUser(targetId)
    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
