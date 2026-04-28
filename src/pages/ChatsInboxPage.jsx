import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function ChatsInboxPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    const { data, error: e1 } = await supabase.rpc('chat_inbox')
    setLoading(false)
    if (e1) {
      setError(e1.message)
      setRows([])
      return
    }
    setRows(Array.isArray(data) ? data : [])
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onFocus = () => void load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  return (
    <div className="page-simple">
      <h1>{t('chats.title')}</h1>
      <p className="muted">{t('chats.lead')}</p>
      {loading ? <LoadingSpinner /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? <p className="muted">{t('chats.empty')}</p> : null}
      <ul className="driver-app-list">
        {rows.map((row) => (
          <li key={row.thread_id} className="card pad-lg">
            <div className="services-row">
              <strong>{row.peer_full_name || t('chats.unknownPeer')}</strong>
              {Number(row.unread_count || 0) > 0 ? (
                <span className="status-pill status-pill--pending">{t('chats.unread', { count: Number(row.unread_count) })}</span>
              ) : null}
            </div>
            <p className="muted small">{row.last_message_body || t('chats.noMessages')}</p>
            <p className="muted tiny">{row.last_message_at ? new Date(row.last_message_at).toLocaleString() : ''}</p>
            <div className="owner-app-actions">
              <Link className="btn ghost small" to={`/chats/${row.thread_id}`}>{t('chats.open')}</Link>
              {row.thread_type === 'application' && row.application_id ? (
                <Link className="btn ghost small" to={`/chats/application/${row.application_id}`}>{t('chats.openApplicationThread')}</Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
