import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/** @typedef {'admin' | 'driver' | 'owner'} UserRole */

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
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error(error)
      setProfile(null)
      return
    }
    setProfile(data)
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
    const roleLower = String(profile?.role ?? '').toLowerCase()
    const isDriver = roleLower === 'driver'
    // UI / routing: tylko jawny „driver” idzie na marketplace. Brak wiersza profiles lub brak roli → jak właściciel (/panel).
    const isAdmin = Boolean(session) && !isDriver
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
