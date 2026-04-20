import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { compressImageToJpeg, retryAsync } from '../utils/handoverImages'

const REQUIRED = ['front', 'rear', 'left', 'right']

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   car: { id: string, driver_id?: string | null, driver_name?: string | null },
 *   ownerId: string,
 *   onSaved: () => void,
 * }} props
 */
export function HandoverWizard({ open, onClose, car, ownerId, onSaved }) {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const [step, setStep] = useState(1)
  const [handoverType, setHandoverType] = useState(/** @type {'pickup' | 'return' | null} */ (null))
  const [required, setRequired] = useState(() => ({ front: null, rear: null, left: null, right: null }))
  const [optionals, setOptionals] = useState(/** @type {{ id: string, blob: Blob | null }[]} */ ([]))
  const [captureTarget, setCaptureTarget] = useState(/** @type {string | null} */ (null))
  const [compressing, setCompressing] = useState(false)
  const [notes, setNotes] = useState('')
  const [recordAt] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(/** @type {{ cur: number, total: number } | null} */ (null))
  const [err, setErr] = useState(/** @type {string | null} */ (null))
  const [done, setDone] = useState(false)
  const [previews, setPreviews] = useState(/** @type {Record<string, string>} */ ({}))

  useEffect(() => {
    if (!open) {
      setPreviews((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
        return {}
      })
      return
    }
    const next = {}
    for (const k of REQUIRED) {
      const b = required[k]
      if (b) next[k] = URL.createObjectURL(b)
    }
    for (const o of optionals) {
      if (o.blob) next[o.id] = URL.createObjectURL(o.blob)
    }
    setPreviews((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u))
      return next
    })
  }, [open, required, optionals])

  useEffect(() => {
    if (!open) {
      setStep(1)
      setHandoverType(null)
      setRequired({ front: null, rear: null, left: null, right: null })
      setOptionals([])
      setNotes('')
      setErr(null)
      setDone(false)
      setProgress(null)
      setCaptureTarget(null)
    }
  }, [open])

  const requiredCount = REQUIRED.filter((k) => required[k]).length
  const canNextStep2 = requiredCount === 4

  const triggerCapture = (target) => {
    setCaptureTarget(target)
    requestAnimationFrame(() => fileRef.current?.click())
  }

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = captureTarget
    setCaptureTarget(null)
    if (!file || !target) return
    setCompressing(true)
    setErr(null)
    try {
      const blob = await compressImageToJpeg(file)
      if (REQUIRED.includes(target)) {
        setRequired((r) => ({ ...r, [target]: blob }))
      } else if (target.startsWith('opt:')) {
        const id = target.slice(4)
        setOptionals((list) => list.map((x) => (x.id === id ? { ...x, blob } : x)))
      }
    } catch (ex) {
      setErr(ex?.message ?? t('handover.compressFailed'))
    } finally {
      setCompressing(false)
    }
  }

  const addOptionalSlot = () => {
    setOptionals((list) => [...list, { id: crypto.randomUUID(), blob: null }])
  }

  const removeOptional = (id) => {
    setOptionals((list) => list.filter((x) => x.id !== id))
  }

  const saveProtocol = async () => {
    if (!handoverType || !canNextStep2) return
    setBusy(true)
    setErr(null)
    const handoverId = crypto.randomUUID()
    const carId = car.id
    const items = [
      ...REQUIRED.map((angle) => ({ angle, blob: required[angle], fileName: `${angle}.jpg` })),
      ...optionals
        .filter((o) => o.blob)
        .map((o, i) => ({ angle: 'extra', blob: o.blob, fileName: `extra_${i}.jpg` })),
    ]
    const total = items.length
    setProgress({ cur: 0, total })

    const publicRows = []

    try {
      let cur = 0
      for (const it of items) {
        if (!it.blob) continue
        const path = `${ownerId}/${carId}/${handoverId}/${it.fileName}`
        await retryAsync(async () => {
          const { error: up } = await supabase.storage.from('handover-photos').upload(path, it.blob, {
            contentType: 'image/jpeg',
            upsert: true,
          })
          if (up) throw up
        })
        const {
          data: { publicUrl },
        } = supabase.storage.from('handover-photos').getPublicUrl(path)
        publicRows.push({ angle: it.angle, photo_url: publicUrl })
        cur += 1
        setProgress({ cur, total })
      }

      const { error: he } = await supabase.from('car_handovers').insert({
        id: handoverId,
        car_id: carId,
        driver_id: car.driver_id ?? null,
        owner_id: ownerId,
        handover_date: recordAt.toISOString(),
        handover_type: handoverType,
        notes: notes.trim() || null,
        driver_name_snapshot: car.driver_name?.trim() || null,
      })
      if (he) throw he

      const { error: pe } = await supabase.from('handover_photos').insert(
        publicRows.map((r) => ({
          handover_id: handoverId,
          photo_url: r.photo_url,
          angle: r.angle,
        }))
      )
      if (pe) throw pe

      setDone(true)
      onSaved()
      window.setTimeout(() => {
        onClose()
      }, 1400)
    } catch (ex) {
      setErr(ex?.message ?? t('handover.saveFailed'))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (!open) return null

  const slot = (key, label) => {
    const blob = required[key]
    const url = previews[key]
    return (
      <div key={key} className="handover-slot">
        <p className="handover-slot-label">{label}</p>
        <button
          type="button"
          className={`handover-slot-area${blob ? ' has-photo' : ''}`}
          onClick={() => !compressing && triggerCapture(key)}
          disabled={compressing || busy}
        >
          {blob && url ? (
            <>
              <img src={url} alt="" className="handover-slot-thumb" />
              <span className="handover-slot-check" aria-hidden>
                ✓
              </span>
            </>
          ) : (
            <span className="handover-slot-placeholder">
              <span className="handover-slot-cam" aria-hidden>
                📸
              </span>
            </span>
          )}
        </button>
        {blob ? (
          <button type="button" className="handover-retake link-like" onClick={() => setRequired((r) => ({ ...r, [key]: null }))}>
            {t('handover.retake')}
          </button>
        ) : null}
      </div>
    )
  }

  return createPortal(
    <div className="handover-wizard-backdrop">
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFileChange} />
      <div className="handover-wizard-panel">
        <div className="handover-wizard-top">
          <button type="button" className="btn ghost handover-wizard-x" onClick={onClose} disabled={busy}>
            {t('app.close')}
          </button>
          <p className="handover-wizard-title">{t('handover.wizardTitle')}</p>
        </div>

        {done ? (
          <div className="handover-wizard-done">
            <p className="handover-success">{t('handover.saveSuccess')}</p>
          </div>
        ) : (
          <>
            {step === 1 ? (
              <div className="handover-step handover-step-type">
                <p className="muted handover-step-hint">{t('handover.step1Hint')}</p>
                <button
                  type="button"
                  className="btn btn-huge primary handover-type-btn"
                  onClick={() => {
                    setHandoverType('pickup')
                    setStep(2)
                  }}
                >
                  {t('handover.typePickup')}
                </button>
                <button
                  type="button"
                  className="btn btn-huge secondary handover-type-btn"
                  onClick={() => {
                    setHandoverType('return')
                    setStep(2)
                  }}
                >
                  {t('handover.typeReturn')}
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="handover-step">
                <div className="handover-progress-bar" aria-hidden>
                  <div
                    className="handover-progress-fill"
                    style={{ width: `${(requiredCount / 4) * 100}%` }}
                  />
                </div>
                <p className="handover-progress-text">
                  {t('handover.progressRequired', { current: requiredCount, total: 4 })}
                </p>
                {compressing ? <p className="muted small">{t('handover.compressing')}</p> : null}
                <div className="handover-grid-2">
                  {slot('front', t('handover.angle.front'))}
                  {slot('rear', t('handover.angle.rear'))}
                  {slot('left', t('handover.angle.left'))}
                  {slot('right', t('handover.angle.right'))}
                </div>
                <button type="button" className="btn btn-huge secondary handover-add-extra" onClick={addOptionalSlot} disabled={compressing || busy}>
                  {t('handover.addPhoto')}
                </button>
                {optionals.map((o) => (
                  <div key={o.id} className="handover-optional-row">
                    <button
                      type="button"
                      className={`handover-slot-area handover-slot-area--wide${o.blob ? ' has-photo' : ''}`}
                      onClick={() => !compressing && triggerCapture(`opt:${o.id}`)}
                      disabled={compressing || busy}
                    >
                      {o.blob && previews[o.id] ? (
                        <>
                          <img src={previews[o.id]} alt="" className="handover-slot-thumb" />
                          <span className="handover-slot-check" aria-hidden>
                            ✓
                          </span>
                        </>
                      ) : (
                        <span className="handover-slot-placeholder">
                          <span className="handover-slot-cam" aria-hidden>
                            📸
                          </span>
                          <span className="muted small">{t('handover.optionalSlot')}</span>
                        </span>
                      )}
                    </button>
                    <div className="handover-optional-actions">
                      {o.blob ? (
                        <button type="button" className="link-like" onClick={() => setOptionals((l) => l.map((x) => (x.id === o.id ? { ...x, blob: null } : x)))}>
                          {t('handover.retake')}
                        </button>
                      ) : null}
                      <button type="button" className="link-like handover-remove-link" onClick={() => removeOptional(o.id)}>
                        {t('handover.removeExtra')}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="handover-step-nav">
                  <button type="button" className="btn ghost" onClick={() => setStep(1)} disabled={busy}>
                    {t('handover.back')}
                  </button>
                  <button type="button" className="btn btn-huge primary" disabled={!canNextStep2 || compressing || busy} onClick={() => setStep(3)}>
                    {t('handover.next')}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="handover-step handover-step-summary">
                <div className="handover-summary-badge-row">
                  <span className={`handover-badge handover-badge--${handoverType}`}>
                    {handoverType === 'pickup' ? t('handover.badgePickup') : t('handover.badgeReturn')}
                  </span>
                </div>
                <p className="handover-summary-meta">
                  <strong>{t('handover.driver')}</strong> {car.driver_name?.trim() || '—'}
                </p>
                <p className="handover-summary-meta muted small">
                  {recordAt.toLocaleString()}
                </p>
                <div className="handover-summary-thumbs">
                  {REQUIRED.map((k) =>
                    required[k] && previews[k] ? <img key={k} src={previews[k]} alt="" className="handover-summary-thumb" /> : null
                  )}
                  {optionals.map((o) =>
                    o.blob && previews[o.id] ? <img key={o.id} src={previews[o.id]} alt="" className="handover-summary-thumb" /> : null
                  )}
                </div>
                <label className="handover-notes-label">{t('handover.notesLabel')}</label>
                <textarea className="input handover-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('handover.notesPlaceholder')} />
                {err ? <p className="form-error">{err}</p> : null}
                {progress ? (
                  <p className="muted small">
                    {t('handover.uploadProgress', { current: progress.cur, total: progress.total })}
                  </p>
                ) : null}
                {progress ? (
                  <div className="handover-progress-bar" aria-hidden>
                    <div className="handover-progress-fill" style={{ width: `${(progress.cur / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                ) : null}
                <div className="handover-step-nav handover-step-nav--stack">
                  <button type="button" className="btn ghost" onClick={() => setStep(2)} disabled={busy}>
                    {t('handover.back')}
                  </button>
                  <button type="button" className="btn btn-huge primary handover-save-btn" disabled={busy} onClick={saveProtocol}>
                    {busy ? t('handover.saving') : t('handover.saveProtocol')}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
