import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''))
}

export function ChatThreadPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { threadId: rawThreadId, applicationId } = useParams()
  const [threadId, setThreadId] = useState(rawThreadId || '')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const listEndRef = useRef(null)

  const idOk = useMemo(() => (applicationId ? isUuid(applicationId) : isUuid(threadId)), [applicationId, threadId])

  const resolveThread = useCallback(async () => {
    if (!applicationId) return threadId
    const { data, error: e1 } = await supabase.rpc('chat_ensure_application_thread', { p_application_id: applicationId })
    if (e1) throw e1
    const resolved = String(data || '')
    setThreadId(resolved)
    return resolved
  }, [applicationId, threadId])

  const loadMessages = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const effectiveThreadId = await resolveThread()
      if (!effectiveThreadId) throw new Error('Thread not found')
      const { data, error: e1 } = await supabase
        .from('chat_messages')
        .select('id,sender_id,body,created_at')
        .eq('thread_id', effectiveThreadId)
        .order('created_at', { ascending: true })
      if (e1) throw e1
      setMessages(Array.isArray(data) ? data : [])
      await supabase
        .from('chat_thread_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('thread_id', effectiveThreadId)
        .eq('user_id', user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [resolveThread, user?.id])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!threadId || !isUuid(threadId)) return
    const channel = supabase
      .channel(`chat-thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new
          if (!row?.id) return
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!user?.id || !threadId || !draft.trim()) return
    setSending(true)
    const { error: e1 } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      body: draft.trim(),
    })
    setSending(false)
    if (e1) {
      setError(e1.message)
      return
    }
    setDraft('')
    await loadMessages()
  }

  if (!idOk) return <Navigate to="/chats" replace />

  return (
    <div className="page-simple app-chat-page">
      <p className="muted small"><Link to="/chats" className="link">← {t('chats.title')}</Link></p>
      <h1>{t('chats.threadTitle')}</h1>
      {loading ? <LoadingSpinner /> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="app-chat-messages card pad-lg">
        {!loading && messages.length === 0 ? <p className="muted small">{t('applicationChat.empty')}</p> : null}
        <ul className="app-chat-list">
          {messages.map((m) => {
            const mine = String(m.sender_id) === String(user?.id)
            return (
              <li key={m.id} className={`app-chat-bubble${mine ? ' app-chat-bubble--mine' : ''}`}>
                <p className="app-chat-bubble-body">{String(m.body)}</p>
                <span className="app-chat-bubble-meta">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
              </li>
            )
          })}
        </ul>
        <div ref={listEndRef} />
      </div>
      <form className="app-chat-form card pad-lg" onSubmit={handleSend}>
        <textarea
          className="app-chat-input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('applicationChat.placeholder')}
          maxLength={4000}
        />
        <button type="submit" className="btn primary" disabled={sending || !draft.trim()}>
          {sending ? t('applicationChat.sending') : t('applicationChat.send')}
        </button>
      </form>
    </div>
  )
}
