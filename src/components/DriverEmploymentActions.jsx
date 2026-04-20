import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

const TERMINATE_REASONS = [
  'reason_mutual',
  'reason_schedule',
  'reason_pay',
  'reason_vehicle',
  'reason_personal',
  'reason_other',
]

/**
 * @param {{ carId: string; userId: string | undefined; onUpdated: () => void }} props
 */
export function DriverEmploymentActions({ carId, userId, onUpdated }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(null)
  const [loadingPending, setLoadingPending] = useState(true)
  const [modal, setModal] = useState(/** @type {'terminate' | 'change' | null} */ (null))
  const [reasonCode, setReasonCode] = useState('reason_mutual')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(/** @type {{ type: 'ok' | 'err'; text: string } | null} */ (null))
  const [flashOk, setFlashOk] = useState(/** @type {string | null} */ (null))

  const loadPending = useCallback(async () => {
    if (!carId || !userId) {
      setPending(null)
      setLoadingPending(false)
      return
    }
    setLoadingPending(true)
    const { data, error } = await supabase
      .from('driver_employment_requests')
      .select('id, kind, status')
      .eq('car_id', carId)
      .eq('driver_id', userId)
      .eq('status', 'pending_owner')
      .maybeSingle()
    setLoadingPending(false)
    if (error) {
      console.error(error)
      setPending(null)
      return
    }
    setPending(data ?? null)
  }, [carId, userId])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const closeModal = () => {
    setModal(null)
    setMsg(null)
    setNote('')
    setReasonCode('reason_mutual')
  }

  useEffect(() => {
    if (!flashOk) return
    const tmr = window.setTimeout(() => setFlashOk(null), 6000)
    return () => window.clearTimeout(tmr)
  }, [flashOk])

  const submitTerminate = async () => {
    if (!carId || !userId) return
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.rpc('driver_submit_employment_request', {
        p_car_id: carId,
        p_kind: 'terminate',
        p_reason_code: reasonCode,
        p_reason_note: note.trim() || null,
      })
      if (error) throw error
      closeModal()
      setFlashOk(t('driverEmployment.successTerminateSubmitted'))
      await loadPending()
      onUpdated()
    } catch (e) {
      setMsg({ type: 'err', text: e?.message ?? String(e) })
    } finally {
      setBusy(false)
    }
  }

  const submitChangeIntent = async () => {
    if (!carId || !userId) return
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.rpc('driver_submit_employment_request', {
        p_car_id: carId,
        p_kind: 'change_vehicle_intent',
        p_reason_code: '',
        p_reason_note: note.trim() || null,
      })
      if (error) throw error
      closeModal()
      setFlashOk(t('driverEmployment.successChangeSubmitted'))
      await loadPending()
      onUpdated()
    } catch (e) {
      setMsg({ type: 'err', text: e?.message ?? String(e) })
    } finally {
      setBusy(false)
    }
  }

  const cancelPending = async () => {
    if (!pending?.id) return
    if (!window.confirm(t('driverEmployment.cancelConfirm'))) return
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.rpc('driver_cancel_employment_request', { p_request_id: pending.id })
      if (error) throw error
      await loadPending()
      onUpdated()
    } catch (e) {
      setMsg({ type: 'err', text: e?.message ?? String(e) })
    } finally {
      setBusy(false)
    }
  }

  if (!carId || !userId) return null

  return (
    <div className="driver-employment-actions">
      {flashOk ? (
        <p className="form-success driver-employment-flash" role="status">
          {flashOk}
        </p>
      ) : null}
      {loadingPending ? <p className="muted small">{t('app.loading')}</p> : null}

      {!loadingPending && pending ? (
        <div className="driver-employment-pending-banner" role="status">
          <p className="driver-employment-pending-title">{t('driverEmployment.pendingTitle')}</p>
          <p className="muted small">{t('driverEmployment.pendingHint')}</p>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => void cancelPending()}>
            {t('driverEmployment.cancelRequestBtn')}
          </button>
        </div>
      ) : null}

      {!loadingPending && !pending ? (
        <div className="driver-employment-actions-row">
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setModal('terminate')}>
            {t('driverEmployment.endWorkBtn')}
          </button>
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => setModal('change')}>
            {t('driverEmployment.changeCarBtn')}
          </button>
        </div>
      ) : null}

      {modal === 'terminate' ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card card pad-lg" role="dialog" aria-modal="true" aria-labelledby="emp-term-title">
            <h2 id="emp-term-title" className="modal-title">
              {t('driverEmployment.modalTerminateTitle')}
            </h2>
            <p className="muted small">{t('driverEmployment.modalTerminateLead')}</p>
            <label className="field-label-lg" htmlFor="emp-reason">
              {t('driverEmployment.reasonSelectLabel')}
            </label>
            <select id="emp-reason" className="input input-xl" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {TERMINATE_REASONS.map((k) => (
                <option key={k} value={k}>
                  {t(`employmentRequest.reasons.${k}`)}
                </option>
              ))}
            </select>
            <label className="field-label-lg" htmlFor="emp-note">
              {t('driverEmployment.noteLabel')}
            </label>
            <textarea id="emp-note" className="input input-xl" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            {msg && modal === 'terminate' ? (
              <p className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</p>
            ) : null}
            <div className="btn-row">
              <button type="button" className="btn ghost" disabled={busy} onClick={closeModal}>
                {t('app.cancel')}
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void submitTerminate()}>
                {busy ? t('driverEmployment.sending') : t('driverEmployment.submit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'change' ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card card pad-lg" role="dialog" aria-modal="true" aria-labelledby="emp-ch-title">
            <h2 id="emp-ch-title" className="modal-title">
              {t('driverEmployment.modalChangeTitle')}
            </h2>
            <p className="muted small">{t('driverEmployment.modalChangeLead')}</p>
            <label className="field-label-lg" htmlFor="emp-ch-note">
              {t('driverEmployment.changeNoteOptional')}
            </label>
            <textarea id="emp-ch-note" className="input input-xl" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            <p className="muted small">
              <Link to="/marketplace" className="link-strong" onClick={closeModal}>
                {t('driverEmployment.goMarketplace')}
              </Link>
            </p>
            {msg && modal === 'change' ? (
              <p className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</p>
            ) : null}
            <div className="btn-row">
              <button type="button" className="btn ghost" disabled={busy} onClick={closeModal}>
                {t('app.cancel')}
              </button>
              <button type="button" className="btn primary" disabled={busy} onClick={() => void submitChangeIntent()}>
                {busy ? t('driverEmployment.sending') : t('driverEmployment.submitIntent')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
