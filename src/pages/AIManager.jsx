import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, Check, Loader2, Lock, Mic, Paperclip, Pencil, PlusCircle, SendHorizontal, Settings, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { analyzeDocument, buildAlertsFromCars, callClaudeMessages, compressImage, extractClaudeText, extractTrailingAction } from '../lib/aiManager'

const QUICK_ACTION_KEYS = ['addVehicle', 'checkDocs', 'showStats', 'addDriver']
const VOICE_AUTO_SEND_KEY = 'ai_voice_auto_send'
const VOICE_LANG_MODE_KEY = 'ai_voice_lang_mode'
const VOICE_LANG_MANUAL_KEY = 'ai_voice_lang_manual'
const VOICE_TIP_SEEN_KEY = 'ai_voice_tooltip_seen'
const VOICE_LANGS = ['uk', 'pl', 'en', 'ru']

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
    .filter((m) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false
      if (typeof m.content === 'string') return true
      return m.kind === 'doc_card' && m.card && typeof m.card === 'object'
    })
    .slice(-50)
}

function normalizePlate(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function formatDate(value, locale) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale).format(date)
}

function hasUsefulExtraction(doc) {
  return Boolean(doc.expiry_date || doc.policy_number || doc.plate_number || doc.car_make || doc.car_model || doc.owner_name || doc.amount || doc.company_name)
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
  const [isListening, setIsListening] = useState(false)
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voiceDurationSec, setVoiceDurationSec] = useState(0)
  const [voiceAutoSend, setVoiceAutoSend] = useState(true)
  const [voiceLangMode, setVoiceLangMode] = useState('auto')
  const [voiceManualLang, setVoiceManualLang] = useState('pl')
  const [voiceTooltipOpen, setVoiceTooltipOpen] = useState(false)
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)
  const listenStartedAtRef = useRef(null)

  const isOwner = profile?.role === 'owner'
  const isAdminRole = profile?.role === 'admin'
  const isPro = isAdminRole || (isOwner && profile?.plan_tier === 'pro')
  const localeCode = i18n.resolvedLanguage || i18n.language || 'pl'
  const lang = localeCode.startsWith('uk') ? 'uk' : localeCode.startsWith('en') ? 'en' : localeCode.startsWith('ru') ? 'ru' : 'pl'
  const alerts = useMemo(() => buildAlertsFromCars(cars), [cars])
  const voiceSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const voiceLanguage = voiceLangMode === 'manual' ? voiceManualLang : lang

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
    if (typeof window === 'undefined') return
    setVoiceAutoSend(window.localStorage.getItem(VOICE_AUTO_SEND_KEY) !== '0')
    setVoiceLangMode(window.localStorage.getItem(VOICE_LANG_MODE_KEY) === 'manual' ? 'manual' : 'auto')
    const savedManual = window.localStorage.getItem(VOICE_LANG_MANUAL_KEY) || 'pl'
    setVoiceManualLang(VOICE_LANGS.includes(savedManual) ? savedManual : 'pl')
  }, [])

  useEffect(() => {
    if (!isListening) return
    const timer = window.setInterval(() => {
      const started = listenStartedAtRef.current
      if (!started) return
      setVoiceDurationSec(Math.max(0, Math.floor((Date.now() - started) / 1000)))
    }, 250)
    return () => window.clearInterval(timer)
  }, [isListening])

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        // no-op on unmount
      }
    }
  }, [])

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
      const conversationHistory = next
        .filter((m) => typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content }))
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
      const userPhotoMsg = { role: 'user', content: t('aiManager.photoUploaded'), ts: nowTs() }
      const next = [...messages, userPhotoMsg]
      setMessages(next)
      const b64 = await compressImage(file)
      const extracted = await analyzeDocument({
        base64Image: b64,
        mediaType: 'image/jpeg',
      })
      if (!hasUsefulExtraction(extracted)) throw new Error('DOCUMENT_NOT_RECOGNIZED')
      const matched = cars.find((car) => normalizePlate(car.plate_number) && normalizePlate(car.plate_number) === normalizePlate(extracted.plate_number))
      const cardId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      const assistant = {
        role: 'assistant',
        kind: 'doc_card',
        card: {
          id: cardId,
          document_type: extracted.document_type || 'other',
          expiry_date: extracted.expiry_date || '',
          policy_number: extracted.policy_number || '',
          plate_number: extracted.plate_number || '',
          car_make: extracted.car_make || '',
          car_model: extracted.car_model || '',
          owner_name: extracted.owner_name || '',
          amount: Number.isFinite(extracted.amount) ? extracted.amount : '',
          company_name: extracted.company_name || '',
          confidence: extracted.confidence || 'low',
          notes: extracted.notes || '',
          selectedVehicleId: matched?.id || cars[0]?.id || '',
          editing: false,
          saving: false,
          saved: false,
        },
        ts: nowTs(),
      }
      const finalMessages = [...next, assistant]
      setMessages(finalMessages)
      await persistMessages(finalMessages)
    } catch (e) {
      const rawMessage = String(e?.message || '')
      if (rawMessage.includes('DOCUMENT_NOT_RECOGNIZED') || rawMessage.includes('DOCUMENT_PARSE_FAILED')) {
        setError(t('aiManager.errors.notRecognized'))
      } else if (rawMessage.toLowerCase().includes('image') || rawMessage.toLowerCase().includes('compress')) {
        setError(t('aiManager.errors.lowQuality'))
      } else {
        setError(e.message ?? t('aiManager.errors.generic'))
      }
    } finally {
      setPhotoBusy(false)
    }
  }

  function updateCard(cardId, updater) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.kind !== 'doc_card' || m.card?.id !== cardId) return m
        return { ...m, card: updater(m.card) }
      })
    )
  }

  async function onSaveDocCard(cardId) {
    const docMessage = messages.find((m) => m.kind === 'doc_card' && m.card?.id === cardId)
    const card = docMessage?.card
    if (!card?.selectedVehicleId) {
      setError(t('aiManager.errors.selectVehicle'))
      return
    }
    setError('')
    updateCard(cardId, (prev) => ({ ...prev, saving: true }))
    try {
      const updates = {}
      if (card.document_type === 'insurance_oc' || card.document_type === 'insurance_ac') {
        updates.insurance_expiry = card.expiry_date || null
      } else if (card.document_type === 'technical_inspection') {
        updates.przeglad_expiry = card.expiry_date || null
      } else if (card.document_type === 'service_invoice') {
        updates.last_service_date = card.expiry_date || new Date().toISOString().slice(0, 10)
        if (card.amount !== '' && card.amount !== null) updates.service_cost = Number(card.amount) || 0
      } else {
        throw new Error(t('aiManager.errors.unsupportedDocumentSave'))
      }
      const { error: saveErr } = await supabase.from('cars').update(updates).eq('id', card.selectedVehicleId).eq('owner_id', user?.id)
      if (saveErr) throw saveErr
      const savedCar = cars.find((car) => car.id === card.selectedVehicleId)
      const successText = t('aiManager.savedForVehicle', { plate: savedCar?.plate_number || '—' })
      const updatedMessages = messages.map((m) => {
        if (m.kind === 'doc_card' && m.card?.id === cardId) {
          return { ...m, card: { ...m.card, editing: false, saving: false, saved: true } }
        }
        return m
      })
      const withSuccess = [...updatedMessages, { role: 'assistant', content: successText, ts: nowTs() }]
      setMessages(withSuccess)
      await persistMessages(withSuccess)
    } catch (e) {
      updateCard(cardId, (prev) => ({ ...prev, saving: false }))
      setError(e.message ?? t('aiManager.errors.generic'))
    }
  }

  function onVoiceInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setError(t('aiManager.errors.voiceUnsupported'))
      return
    }
    if (busy || photoBusy || isVoiceProcessing) return
    const langMap = { uk: 'uk-UA', pl: 'pl-PL', en: 'en-US', ru: 'ru-RU' }
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = langMap[voiceLanguage] || 'pl-PL'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = () => {
      listenStartedAtRef.current = Date.now()
      setVoiceDurationSec(0)
      setIsListening(true)
      setIsVoiceProcessing(false)
      setVoiceText('')
    }
    recognition.onresult = (e) => {
      const result = e?.results?.[0]
      const transcript = result?.[0]?.transcript ?? ''
      if (!transcript) return
      setVoiceText(transcript)
      if (result?.isFinal) {
        setInput(transcript)
        setIsListening(false)
        setIsVoiceProcessing(false)
        if (voiceAutoSend) {
          window.setTimeout(() => {
            void sendMessage(transcript)
          }, 450)
        }
      }
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      setIsVoiceProcessing(false)
      if (event?.error === 'no-speech') {
        setError(t('aiManager.errors.voiceNoSpeech'))
      } else if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        setError(t('aiManager.errors.voicePermission'))
      } else {
        setError(t('aiManager.errors.voiceFailed'))
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      setIsVoiceProcessing(false)
    }
    recognition.start()
    if (typeof window !== 'undefined' && window.localStorage.getItem(VOICE_TIP_SEEN_KEY) !== '1') {
      setVoiceTooltipOpen(true)
      window.localStorage.setItem(VOICE_TIP_SEEN_KEY, '1')
      window.setTimeout(() => setVoiceTooltipOpen(false), 5200)
    }
  }

  function onVoiceRelease() {
    if (!isListening) return
    setIsVoiceProcessing(true)
    try {
      recognitionRef.current?.stop()
    } catch {
      setIsVoiceProcessing(false)
    }
  }

  function onVoiceAutoSendToggle() {
    const next = !voiceAutoSend
    setVoiceAutoSend(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(VOICE_AUTO_SEND_KEY, next ? '1' : '0')
  }

  function onVoiceLangModeChange(nextMode) {
    setVoiceLangMode(nextMode)
    if (typeof window !== 'undefined') window.localStorage.setItem(VOICE_LANG_MODE_KEY, nextMode)
  }

  function onVoiceManualLangChange(nextLang) {
    setVoiceManualLang(nextLang)
    if (typeof window !== 'undefined') window.localStorage.setItem(VOICE_LANG_MANUAL_KEY, nextLang)
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
          {!isOwner && !isAdminRole ? (
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
        <div className="ai-header-actions">
          <div className="ai-settings-wrap">
            <button type="button" className="btn ghost small" onClick={() => setVoiceSettingsOpen((s) => !s)} aria-label={t('aiManager.voiceSettings.title')}>
              <Settings size={15} />
            </button>
            {voiceSettingsOpen ? (
              <div className="ai-settings-pop card">
                <p className="small muted">{t('aiManager.voiceSettings.title')}</p>
                <label className="ai-settings-toggle">
                  <span>{t('aiManager.voiceSettings.autoSend')}</span>
                  <input type="checkbox" checked={voiceAutoSend} onChange={onVoiceAutoSendToggle} />
                </label>
                <label className="ai-settings-select">
                  <span>{t('aiManager.voiceSettings.language')}</span>
                  <select className="input" value={voiceLangMode} onChange={(e) => onVoiceLangModeChange(e.target.value)}>
                    <option value="auto">{t('aiManager.voiceSettings.autoLanguage')}</option>
                    <option value="manual">{t('aiManager.voiceSettings.manualLanguage')}</option>
                  </select>
                </label>
                {voiceLangMode === 'manual' ? (
                  <label className="ai-settings-select">
                    <span>{t('aiManager.voiceSettings.manualLanguageLabel')}</span>
                    <select className="input" value={voiceManualLang} onChange={(e) => onVoiceManualLangChange(e.target.value)}>
                      <option value="uk">Українська</option>
                      <option value="pl">Polski</option>
                      <option value="en">English</option>
                      <option value="ru">Русский</option>
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
          <button type="button" className="btn ghost small" onClick={onNewConversation} disabled={busy || photoBusy || isListening}>
            {t('aiManager.newConversation')}
          </button>
        </div>
      </header>

      <section className="ai-manager-messages card">
        {messages.map((m, idx) => (
          <article key={`${m.ts}-${idx}`} className={`ai-msg ai-msg--${m.role}`}>
            <div className="ai-msg-avatar" aria-hidden>
              {m.role === 'assistant' ? <Bot size={16} /> : <Sparkles size={16} />}
            </div>
            <div className="ai-msg-bubble">
              {m.kind === 'doc_card' && m.card ? (
                <div className="ai-doc-card">
                  <div className="ai-doc-card__head">
                    <strong>{t('aiManager.docCard.title')}</strong>
                    <span className={`ai-doc-card__confidence ai-doc-card__confidence--${m.card.confidence || 'low'}`}>
                      {t(`aiManager.docCard.confidence.${m.card.confidence || 'low'}`)}
                    </span>
                  </div>
                  <p>{t(`aiManager.docType.${m.card.document_type || 'other'}`)}</p>
                  <p>
                    {t('aiManager.docCard.policy')}: {m.card.policy_number || '—'}
                  </p>
                  <p>
                    {t('aiManager.docCard.expiry')}: {formatDate(m.card.expiry_date, localeCode)}
                  </p>
                  <p>
                    {t('aiManager.docCard.car')}:{' '}
                    {[m.card.car_make, m.card.car_model, m.card.plate_number].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p>
                    {t('aiManager.docCard.company')}: {m.card.company_name || '—'}
                  </p>
                  {m.card.confidence === 'low' ? <p className="ai-doc-card__warning">{t('aiManager.lowConfidence')}</p> : null}
                  <div className="ai-doc-card__form">
                    <label className="small muted">{t('aiManager.docCard.chooseVehicle')}</label>
                    <select
                      className="input"
                      value={m.card.selectedVehicleId || ''}
                      onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, selectedVehicleId: e.target.value }))}
                      disabled={m.card.saving}
                    >
                      {cars.map((car) => (
                        <option key={car.id} value={car.id}>
                          {[car.plate_number, car.model].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  {m.card.editing ? (
                    <div className="ai-doc-card__edit-grid">
                      <input className="input" placeholder={t('aiManager.docCard.fields.policy')} value={m.card.policy_number || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, policy_number: e.target.value }))} />
                      <input className="input" type="date" value={m.card.expiry_date || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, expiry_date: e.target.value }))} />
                      <input className="input" placeholder={t('aiManager.docCard.fields.plate')} value={m.card.plate_number || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, plate_number: e.target.value }))} />
                      <input className="input" placeholder={t('aiManager.docCard.fields.make')} value={m.card.car_make || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, car_make: e.target.value }))} />
                      <input className="input" placeholder={t('aiManager.docCard.fields.model')} value={m.card.car_model || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, car_model: e.target.value }))} />
                      <input className="input" placeholder={t('aiManager.docCard.fields.company')} value={m.card.company_name || ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, company_name: e.target.value }))} />
                      <input className="input" type="number" placeholder={t('aiManager.docCard.fields.amount')} value={m.card.amount ?? ''} onChange={(e) => updateCard(m.card.id, (prev) => ({ ...prev, amount: e.target.value }))} />
                    </div>
                  ) : null}
                  <div className="ai-doc-card__actions">
                    <button type="button" className="btn primary small" onClick={() => onSaveDocCard(m.card.id)} disabled={m.card.saving || !m.card.selectedVehicleId}>
                      <Check size={14} /> {t('aiManager.docCard.save')}
                    </button>
                    <button type="button" className="btn ghost small" onClick={() => updateCard(m.card.id, (prev) => ({ ...prev, editing: !prev.editing }))} disabled={m.card.saving}>
                      <Pencil size={14} /> {t('aiManager.docCard.edit')}
                    </button>
                  </div>
                </div>
              ) : (
                <p>{m.content}</p>
              )}
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
        {!voiceSupported ? <p className="muted small">{t('aiManager.voiceUnsupportedInfo')}</p> : null}
        {isListening ? (
          <div className="ai-voice-live">
            <div className="ai-voice-live__top">
              <span className="ai-voice-dot" />
              <span>{t('aiManager.listening')}</span>
              <span className="ai-voice-timer">{String(Math.floor(voiceDurationSec / 60)).padStart(2, '0')}:{String(voiceDurationSec % 60).padStart(2, '0')}</span>
            </div>
            <div className="ai-voice-wave" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="small muted">
              {t('aiManager.listeningPreview')}: <em>{voiceText || '…'}</em>
            </p>
          </div>
        ) : null}
        {voiceTooltipOpen ? (
          <p className="small ai-voice-tip">{t('aiManager.voiceTip')}</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="ai-compose-row">
          <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()} disabled={busy || photoBusy} aria-label={t('aiManager.attach')}>
            <Paperclip size={16} />
          </button>
          {voiceSupported ? (
            <button
              type="button"
              className={`btn ghost small ai-voice-btn ${isListening ? 'is-listening' : ''}`}
              onPointerDown={onVoiceInput}
              onPointerUp={onVoiceRelease}
              onPointerCancel={onVoiceRelease}
              onPointerLeave={onVoiceRelease}
              disabled={busy || photoBusy || isVoiceProcessing}
              aria-label={t('aiManager.tapToSpeak')}
            >
              {isVoiceProcessing ? <Loader2 size={16} className="ai-spin" /> : <Mic size={16} />}
            </button>
          ) : null}
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
