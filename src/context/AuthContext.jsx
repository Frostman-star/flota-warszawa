import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import { normalizeProfileRole } from '../utils/profileRole'

/** @typedef {'admin' | 'driver' | 'owner'} UserRole */
const PENDING_OWNER_REF_CODE_KEY = 'cario_owner_ref_code'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const delaysMs = [0, 200, 400, 700]
    for (let i = 0; i < delaysMs.length; i++) {
      if (delaysMs[i] > 0) await new Promise((r) => setTimeout(r, delaysMs[i]))
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, role, phone, experience_years, bio, gender, birth_year, poland_status, poland_status_doc_url, avatar_url, plan_tier, plan_expires_at, pro_bonus_months'
        )
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.error(error)
        setProfile(null)
        return
      }
      if (data) {
        setProfile(data)
        return
      }
    }
    setProfile(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session ?? null)
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id)
      } else {
        setProfile(null)
      }
      if (!cancelled) setLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Інакше подвійне завантаження: finally тут може скинути loading=true
      // раніше, ніж init() встигне записати profile → хибний редірект на /brak-pojazdu.
      if (event === 'INITIAL_SESSION') return

      setSession(nextSession ?? null)
      if (nextSession?.user?.id) {
        setLoading(true)
        loadProfile(nextSession.user.id).finally(() => {
          if (!cancelled) setLoading(false)
        })
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadProfile])

  useEffect(() => {
    if (!session?.user?.id) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    subscribeToPush(session.user).catch((e) => {
      console.error('[Cario] auto subscribe failed', e)
    })
  }, [session?.user])

  useEffect(() => {
    if (!session?.user?.id || !profile?.id) return
    if (normalizeProfileRole(profile?.role) !== 'owner') return
    if (typeof window === 'undefined') return

    const pendingCode = window.localStorage.getItem(PENDING_OWNER_REF_CODE_KEY)
    if (!pendingCode) return

    supabase
      .rpc('claim_owner_referral', { p_code: pendingCode })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Cario] claim referral failed', error)
          return
        }
        if (data && data !== 'unauthorized' && data !== 'not_owner') {
          window.localStorage.removeItem(PENDING_OWNER_REF_CODE_KEY)
        }
      })
      .catch((err) => {
        console.error('[Cario] claim referral failed', err)
      })
  }, [session?.user?.id, profile?.id, profile?.role])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      const uid = data.session.user?.id
      if (uid) await loadProfile(uid)
    }
    return data
  }, [loadProfile])

  const signUp = useCallback(async (email, password, fullName, signupRole) => {
    const role = signupRole === 'owner' ? 'owner' : 'driver'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          signup_role: role,
        },
      },
    })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      const uid = data.session.user?.id
      if (uid) await loadProfile(uid)
    }
    return data
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id)
  }, [loadProfile, session?.user?.id])

  const value = useMemo(() => {
    const roleNorm = normalizeProfileRole(profile?.role)
    const hasProfile = Boolean(profile)
    const isDriver = hasProfile && roleNorm === 'driver'
    // Panel / flota: owner i admin (legacy) — jak w public.is_admin(). Tylko jawny „driver” = marketplace / widok kierowcy.
    // Gdy profile == null (np. chwilowo po logowaniu), nie traktuj użytkownika jako admin — unika fałszywego widoku właściciela dla kierowcy.
    const isAdmin = Boolean(session?.user) && hasProfile && roleNorm !== 'driver'
    return {
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAdmin,
      isDriver,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }
  }, [session, profile, loading, signIn, signUp, signOut, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musi być użyte wewnątrz AuthProvider')
  return ctx
}
