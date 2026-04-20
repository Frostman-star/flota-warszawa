import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ''))
}

export function ApplicationChatPage() {
  const { applicationId } = useParams()
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()
  const [loadingApp, setLoadingApp] = useState(true)
  const [appRow, setAppRow] = useState(null)
  const [appErr, setAppErr] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgLoading, setMsgLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listEndRef = useRef(null)

  const idOk = useMemo(() => isUuid(applicationId), [applicationId])

  const loadApplication = useCallback(async () => {
    if (!user?.id || !applicationId || !idOk) return
    setLoadingApp(true)
    setAppErr(null)
    const { data, error } = await supabase
      .from('driver_applications')
      .select(
        `
        id,
        status,
        lead_source,
        driver_id,
        owner_id,
        car_id,
        car:cars ( plate_number, model, year )
      `
      )
      .eq('id', applicationId)
      .maybeSingle()
    setLoadingApp(false)
    if (error) {
      setAppErr(error.message)
      setAppRow(null)
      return
    }
    if (!data) {
      setAppRow(null)
      return
    }
    const driverId = String(data.driver_id ?? '')
    const ownerId = String(data.owner_id ?? '')
    const uid = String(user.id)
    if (uid !== driverId && uid !== ownerId) {
      setAppErr('forbidden')
      setAppRow(null)
      return
    }
    setAppRow(data)
  }, [applicationId, idOk, user?.id])

  const loadMessages = useCallback(async () => {
    if (!applicationId || !idOk) return
    setMsgLoading(true)
    const { data, error } = await supabase
      .from('application_chat_messages')
      .select('id, sender_id, body, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })
    setMsgLoading(false)
    if (error) {
      console.error(error)
      setMessages([])
      return
    }
    setMessages(data ?? [])
  }, [applicationId, idOk])

  useEffect(() => {
    void loadApplication()
  }, [loadApplication])

  useEffect(() => {
    if (!appRow) return
    void loadMessages()
  }, [appRow, loadMessages])

  useEffect(() => {
    if (!applicationId || !idOk || !appRow) return
    const channel = supabase
      .channel(`application-chat:${applicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'application_chat_messages',
          filter: `application_id=eq.${applicationId}`,
        },
        (payload) => {
          const row = payload.new
          if (!row?.id) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row]
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applicationId, idOk, appRow])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const canSend = appRow && (appRow.status === 'pending' || appRow.status === 'accepted')

  async function handleSend(e) {
    e.preventDefault()
    if (!canSend || !user?.id || !applicationId) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    const { error } = await supabase.from('application_chat_messages').insert({
      application_id: applicationId,
      sender_id: user.id,
      body: text,
    })
    setSending(false)
    if (error) {
      console.error(error)
      return
    }
    setDraft('')
    void loadMessages()
  }

  if (!idOk) {
    return <Navigate to="/" replace />
  }

  if (loadingApp) {
    return (
      <div className="page-simple app-chat-page">
        <LoadingSpinner />
      </div>
    )
  }

  if (appErr === 'forbidden' || (!appRow && !appErr)) {
    return <Navigate to="/" replace />
  }

  if (appErr && appRow === null) {
    return (
      <div className="page-simple app-chat-page">
        <p className="form-error">{appErr}</p>
        <Link to={isAdmin ? '/wnioski' : '/moje-wnioski'} className="link">
          {isAdmin ? t('applicationChat.backOwner') : t('applicationChat.backDriver')}
        </Link>
      </div>
    )
  }

  const car = appRow?.car
  const plate = car?.plate_number != null ? String(car.plate_number) : '—'
  const titleCar = [car?.model, car?.year].filter(Boolean).join(' ')

  return (
    <div className="page-simple app-chat-page">
      <p className="muted small">
        <Link to={isAdmin ? '/wnioski' : '/moje-wnioski'} className="link">
          {isAdmin ? t('applicationChat.backOwner') : t('applicationChat.backDriver')}
        </Link>
      </p>
      <header className="app-chat-head">
        <h1>{t('applicationChat.title')}</h1>
        <p className="muted small">
          {plate}
          {titleCar ? ` · ${titleCar}` : ''}
        </p>
        <span className="app-chat-lead-badge" title={t('applicationChat.leadBadgeTitle')}>
          {t(`ownerApplications.leadSource.${String(appRow.lead_source || 'unknown')}`)}
        </span>
      </header>

      {!canSend ? (
        <p className="muted app-chat-closed">{t('applicationChat.closed')}</p>
      ) : null}

      <div className="app-chat-messages card pad-lg">
        {msgLoading ? <LoadingSpinner /> : null}
        {!msgLoading && messages.length === 0 ? <p className="muted small">{t('applicationChat.empty')}</p> : null}
        <ul className="app-chat-list">
          {messages.map((m) => {
            const mine = String(m.sender_id) === String(user?.id)
            return (
              <li key={m.id} className={`app-chat-bubble${mine ? ' app-chat-bubble--mine' : ''}`}>
                <p className="app-chat-bubble-body">{String(m.body)}</p>
                <span className="app-chat-bubble-meta">
                  {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                </span>
              </li>
            )
          })}
        </ul>
        <div ref={listEndRef} />
      </div>

      {canSend ? (
        <form className="app-chat-form card pad-lg" onSubmit={handleSend}>
          <label className="sr-only" htmlFor="app-chat-input">
            {t('applicationChat.placeholder')}
          </label>
          <textarea
            id="app-chat-input"
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
      ) : null}
    </div>
  )
}
