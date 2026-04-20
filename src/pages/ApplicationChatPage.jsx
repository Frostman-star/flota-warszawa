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
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignBanner, setAssignBanner] = useState(/** @type {{ type: 'success' | 'error'; text: string } | null} */ (null))
  const listEndRef = useRef(null)

  const idOk = useMemo(() => isUuid(applicationId), [applicationId])
  const isOwner = useMemo(
    () => Boolean(user?.id && appRow?.owner_id && String(user.id) === String(appRow.owner_id)),
    [user?.id, appRow?.owner_id]
  )

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

  const assignDriverToCar = useCallback(async () => {
    if (!applicationId || !idOk || !isOwner) return
    if (!window.confirm(t('applicationChat.assignConfirm'))) return
    setAssignBusy(true)
    setAssignBanner(null)
    try {
      const { data: existing, error: peekErr } = await supabase.rpc('get_driver_current_assignment_for_application', {
        p_application_id: applicationId,
      })
      if (peekErr) throw peekErr
      const row = Array.isArray(existing) ? existing[0] : null
      const otherPlate = row?.plate != null ? String(row.plate).trim() : ''
      if (otherPlate) {
        const ok = window.confirm(t('ownerApplications.reassignBody', { plate: otherPlate }))
        if (!ok) {
          setAssignBusy(false)
          return
        }
      }
      const { error } = await supabase.rpc('assign_driver_from_application', { p_application_id: applicationId })
      if (error) throw error
      setAssignBanner({ type: 'success', text: t('applicationChat.assignSuccess') })
      await loadApplication()
      void loadMessages()
    } catch (e) {
      console.error(e)
      setAssignBanner({ type: 'error', text: e?.message ?? String(e) })
    } finally {
      setAssignBusy(false)
    }
  }, [applicationId, idOk, isOwner, loadApplication, loadMessages, t])

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

      {assignBanner ? (
        <p
          className={assignBanner.type === 'success' ? 'owner-apps-banner owner-apps-banner--ok app-chat-assign-banner' : 'form-error app-chat-assign-banner'}
          role="status"
        >
          {assignBanner.text}
        </p>
      ) : null}

      {isOwner && appRow.status === 'pending' ? (
        <section className="card pad-lg app-chat-assign-block" aria-labelledby="app-chat-assign-title">
          <h2 id="app-chat-assign-title" className="app-chat-assign-title">
            {t('applicationChat.assignTitle')}
          </h2>
          <p className="muted small app-chat-assign-lead">{t('applicationChat.assignLead')}</p>
          <button
            type="button"
            className="btn primary owner-app-accept"
            disabled={assignBusy}
            onClick={() => void assignDriverToCar()}
          >
            {assignBusy ? t('applicationChat.assignBusy') : t('applicationChat.assignButton')}
          </button>
        </section>
      ) : null}

      {isOwner && appRow.status === 'accepted' ? (
        <p className="muted small app-chat-assigned-note">{t('applicationChat.assignDoneNote')}</p>
      ) : null}

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
