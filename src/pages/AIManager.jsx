import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, Lock, Mic, Paperclip, PlusCircle, SendHorizontal, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { buildAlertsFromCars, callClaudeMessages, extractClaudeText, extractTrailingAction, toBase64 } from '../lib/aiManager'

const QUICK_ACTION_KEYS = ['addVehicle', 'checkDocs', 'showStats', 'addDriver']

function makeSystemPrompt({ vehicles, alerts, language }) {
  const languageHint = language === 'uk' ? 'українська' : 'polski'
  return `Jesteś pomocnikiem zarządzania flotą taksówek w aplikacji Cario. Pomagasz właścicielom flot zarządzać pojazdami, dokumentami i kierowcami przez rozmowę.

Masz dostęp do następujących danych użytkownika:

- Lista pojazdów: ${JSON.stringify(vehicles)}
- Liczba pojazdów: ${vehicles.length}
- Alerty dokumentów: ${JSON.stringify(alerts)}

Możesz wykonywać następujące akcje poprzez JSON w swojej odpowiedzi:

1. Dodanie pojazdu: {"action": "add_vehicle", "data": {"plate": "WX4821K", "model": "Toyota Prius", "year": 2016, "weekly_rent": 850}}
2. Aktualizacja dokumentu: {"action": "update_document", "data": {"vehicle_id": "xxx", "field": "insurance_expiry", "value": "2026-08-15"}}
3. Aktualizacja przebiegu: {"action": "update_mileage", "data": {"vehicle_id": "xxx", "mileage": 125000}}
4. Pokaż statystyki: {"action": "show_stats"}

Zawsze odpowiadaj w języku użytkownika (${languageHint}).
Bądź pomocny, krótki i konkretny.
Jeśli wykonujesz akcję, najpierw potwierdź co zrobisz, potem wykonaj.
Format odpowiedzi: tekst dla użytkownika, opcjonalnie JSON akcji na końcu.`
}

function nowTs() {
  return new Date().toISOString()
}

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-50)
}

export function AIManager() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { cars = [] } = useOutletContext() ?? {}
  const { user, profile } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const isOwner = profile?.role === 'owner'
  const isPro = isOwner && profile?.plan_tier === 'pro'
  const lang = (i18n.resolvedLanguage || i18n.language || 'pl').startsWith('uk') ? 'uk' : 'pl'
  const alerts = useMemo(() => buildAlertsFromCars(cars), [cars])

  const welcomeMessage = useMemo(
    () => ({
      role: 'assistant',
      content: t('aiManager.welcome'),
      ts: nowTs(),
    }),
    [t]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, photoBusy])

  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    ;(async () => {
      const { data, error: loadErr } = await supabase
        .from('ai_conversations')
        .select('id, messages')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!mounted) return
      if (loadErr) {
        setError(loadErr.message)
        setMessages([welcomeMessage])
        return
      }
      if (data?.id) {
        setConversationId(data.id)
        const loaded = normalizeMessages(data.messages)
        setMessages(loaded.length ? loaded : [welcomeMessage])
      } else {
        setMessages([welcomeMessage])
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.id, welcomeMessage])

  async function persistMessages(nextMessages, existingConversationId = conversationId) {
    if (!user?.id) return existingConversationId
    const trimmed = nextMessages.slice(-50)
    if (existingConversationId) {
      const { error: upErr } = await supabase
        .from('ai_conversations')
        .update({ messages: trimmed, updated_at: nowTs() })
        .eq('id', existingConversationId)
      if (upErr) throw upErr
      return existingConversationId
    }
    const { data, error: insErr } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, messages: trimmed })
      .select('id')
      .single()
    if (insErr) throw insErr
    if (data?.id) setConversationId(data.id)
    return data?.id ?? null
  }

  async function executeAction(action) {
    if (!action || typeof action !== 'object') return null
    const name = action.action
    const data = action.data || {}
    if (name === 'show_stats') {
      navigate('/statystyki')
      return t('aiManager.done')
    }
    if (name === 'add_vehicle') {
      const payload = {
        owner_id: user?.id,
        plate_number: data.plate ?? null,
        model: data.model ?? null,
        year: data.year ?? null,
        weekly_rent_pln: data.weekly_rent ?? null,
        show_in_marketplace: false,
      }
      if (!payload.plate_number) throw new Error(t('aiManager.errors.missingPlate'))
      const { error: addErr } = await supabase.from('cars').insert(payload)
      if (addErr) throw addErr
      return t('aiManager.done')
    }
    if (name === 'update_document') {
      const allowed = new Set(['insurance_expiry', 'oc_expiry', 'ac_expiry', 'przeglad_expiry', 'last_service_date'])
      if (!allowed.has(data.field)) throw new Error(t('aiManager.errors.invalidDocumentField'))
      const { error: docErr } = await supabase
        .from('cars')
        .update({ [data.field]: data.value ?? null })
        .eq('id', data.vehicle_id)
        .eq('owner_id', user?.id)
      if (docErr) throw docErr
      return t('aiManager.done')
    }
    if (name === 'update_mileage') {
      const { error: milErr } = await supabase
        .from('cars')
        .update({ mileage_km: Number(data.mileage) || 0 })
        .eq('id', data.vehicle_id)
        .eq('owner_id', user?.id)
      if (milErr) throw milErr
      return t('aiManager.done')
    }
    return null
  }

  async function sendMessage(text, extraUserContent = null) {
    const content = (text || '').trim()
    if (!content || busy || photoBusy) return
    setBusy(true)
    setError('')
    const next = [...messages, { role: 'user', content, ts: nowTs() }]
    setMessages(next)
    try {
      const systemPrompt = makeSystemPrompt({ vehicles: cars, alerts, language: lang })
      const conversationHistory = next.map((m) => ({ role: m.role, content: m.content }))
      const payload = await callClaudeMessages({
        systemPrompt,
        messages: extraUserContent
          ? [...conversationHistory.slice(0, -1), { role: 'user', content: extraUserContent }]
          : conversationHistory,
        maxTokens: 1000,
      })
      const textResponse = extractClaudeText(payload)
      const { cleanText, action } = extractTrailingAction(textResponse)
      const assistantMessage = { role: 'assistant', content: cleanText || t('aiManager.emptyAnswer'), ts: nowTs() }
      let afterAssistant = [...next, assistantMessage]
      if (action) {
        try {
          const confirmText = await executeAction(action)
          if (confirmText) afterAssistant = [...afterAssistant, { role: 'assistant', content: confirmText, ts: nowTs() }]
        } catch (actErr) {
          afterAssistant = [...afterAssistant, { role: 'assistant', content: `❌ ${actErr.message}`, ts: nowTs() }]
        }
      }
      setMessages(afterAssistant)
      await persistMessages(afterAssistant)
    } catch (e) {
      setError(e.message ?? t('aiManager.errors.generic'))
      const withErr = [...next, { role: 'assistant', content: `❌ ${e.message ?? t('aiManager.errors.generic')}`, ts: nowTs() }]
      setMessages(withErr)
      await persistMessages(withErr)
    } finally {
      setInput('')
      setBusy(false)
    }
  }

  async function onNewConversation() {
    const fresh = [welcomeMessage]
    setMessages(fresh)
    setError('')
    try {
      const { data, error: insErr } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user?.id, messages: fresh })
        .select('id')
        .single()
      if (insErr) throw insErr
      setConversationId(data?.id ?? null)
    } catch (e) {
      setError(e.message ?? t('aiManager.errors.generic'))
    }
  }

  async function onPhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setError('')
    try {
      const b64 = await toBase64(file)
      const prompt = t('aiManager.photoPrompt')
      const photoContent = [
        { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 } },
        { type: 'text', text: prompt },
      ]
      const userPhotoMsg = { role: 'user', content: t('aiManager.photoUploaded'), ts: nowTs() }
      const next = [...messages, userPhotoMsg]
      setMessages(next)
      const payload = await callClaudeMessages({
        systemPrompt: makeSystemPrompt({ vehicles: cars, alerts, language: lang }),
        messages: [...next.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: photoContent }],
        maxTokens: 1000,
      })
      const extracted = extractClaudeText(payload) || t('aiManager.emptyAnswer')
      const assistant = { role: 'assistant', content: `${extracted}\n\n${t('aiManager.photoConfirm')}`, ts: nowTs() }
      const finalMessages = [...next, assistant]
      setMessages(finalMessages)
      await persistMessages(finalMessages)
    } catch (e) {
      setError(e.message ?? t('aiManager.errors.generic'))
    } finally {
      setPhotoBusy(false)
    }
  }

  function onVoiceInput() {
    const Recognition = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!Recognition) {
      setError(t('aiManager.errors.voiceUnsupported'))
      return
    }
    const recognition = new Recognition()
    recognition.lang = lang === 'uk' ? 'uk-UA' : 'pl-PL'
    recognition.onresult = (e) => {
      const transcript = e?.results?.[0]?.[0]?.transcript ?? ''
      if (transcript) setInput(transcript)
    }
    recognition.onerror = () => setError(t('aiManager.errors.voiceFailed'))
    recognition.start()
  }

  async function onUpgrade() {
    setBusy(true)
    setError('')
    try {
      const { data, error: upErr } = await supabase.rpc('set_my_owner_plan', { p_tier: 'pro' })
      if (upErr) throw upErr
      if (data !== 'ok') throw new Error(t('aiManager.errors.upgradeFailed'))
      window.location.reload()
    } catch (e) {
      setError(e.message ?? t('aiManager.errors.upgradeFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!isPro) {
    return (
      <div className="page-pad ai-upgrade-page">
        <section className="card pad-lg ai-upgrade-card">
          <div className="ai-upgrade-head">
            <h1>🤖 {t('aiManager.title')}</h1>
            <span className="chip">{t('aiManager.proFeature')}</span>
          </div>
          <p className="muted">{t('aiManager.proOnly')}</p>
          <ul className="ai-upgrade-list">
            <li>{t('aiManager.proItem1')}</li>
            <li>{t('aiManager.proItem2')}</li>
            <li>{t('aiManager.proItem3')}</li>
          </ul>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="button" className="btn primary" onClick={onUpgrade} disabled={busy}>
            {t('aiManager.upgradeCta')}
          </button>
          {!isOwner ? (
            <p className="muted small ai-upgrade-note">
              <Lock size={14} /> {t('aiManager.ownerOnly')}
            </p>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <div className="ai-manager-page">
      <header className="ai-manager-header">
        <div className="ai-manager-title-wrap">
          <h1>🤖 {t('aiManager.title')}</h1>
          <span className="ai-pro-badge">Pro</span>
        </div>
        <button type="button" className="btn ghost small" onClick={onNewConversation} disabled={busy || photoBusy}>
          {t('aiManager.newConversation')}
        </button>
      </header>

      <section className="ai-manager-messages card">
        {messages.map((m, idx) => (
          <article key={`${m.ts}-${idx}`} className={`ai-msg ai-msg--${m.role}`}>
            <div className="ai-msg-avatar" aria-hidden>
              {m.role === 'assistant' ? <Bot size={16} /> : <Sparkles size={16} />}
            </div>
            <div className="ai-msg-bubble">
              <p>{m.content}</p>
            </div>
          </article>
        ))}
        <div ref={bottomRef} />
      </section>

      <div className="ai-manager-compose card">
        <div className="chip-row ai-quick-row">
          {QUICK_ACTION_KEYS.map((k) => (
            <button key={k} type="button" className="chip" onClick={() => sendMessage(t(`aiManager.quick.${k}`))} disabled={busy || photoBusy}>
              {t(`aiManager.quick.${k}`)}
            </button>
          ))}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="ai-compose-row">
          <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()} disabled={busy || photoBusy} aria-label={t('aiManager.attach')}>
            <Paperclip size={16} />
          </button>
          <button type="button" className="btn ghost small" onClick={onVoiceInput} disabled={busy || photoBusy} aria-label={t('aiManager.voice')}>
            <Mic size={16} />
          </button>
          <input
            className="input ai-input"
            placeholder={t('aiManager.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
          />
          <button type="button" className="btn primary small" onClick={() => sendMessage(input)} disabled={busy || photoBusy}>
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="ai-hidden-file" onChange={onPhotoSelected} />
      {(busy || photoBusy) && (
        <div className="ai-busy-indicator">
          <PlusCircle size={15} /> {photoBusy ? t('aiManager.photoAnalyzing') : t('aiManager.thinking')}
        </div>
      )}
    </div>
  )
}
