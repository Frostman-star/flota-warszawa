import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { normalizeProfileRole } from '../utils/profileRole'

export function AuthCallback() {
  const { t } = useTranslation()
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function resolvePath() {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user?.id
      if (!uid) {
        if (!cancelled) setTarget('/login')
        return
      }
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .maybeSingle()
      if (profErr) {
        if (!cancelled) setError(profErr.message)
        return
      }
      const role = normalizeProfileRole(profile?.role)
      if (!cancelled) {
        if (role === 'owner' || role === 'admin') setTarget('/panel')
        else if (role === 'driver') setTarget('/marketplace')
        else setTarget('/wybierz-role')
      }
    }
    void resolvePath()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <div className="page-simple"><p className="form-error">{error}</p></div>
  if (target) return <Navigate to={target} replace />
  return (
    <div className="center-page">
      <LoadingSpinner />
      <p className="muted small">{t('authCallback.loading')}</p>
    </div>
  )
}
