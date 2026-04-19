import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

/**
 * @param {{ open: boolean, onClose: () => void, onSave: (text: string) => Promise<void> }} props
 */
export function NoteModal({ open, onClose, onSave }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setText('')
  }, [open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave(text)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={t('noteModal.title')}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t('noteModal.cancel')}
          </button>
          <button type="submit" form="note-f" className="btn primary" disabled={busy}>
            {t('noteModal.save')}
          </button>
        </div>
      }
    >
      <form id="note-f" onSubmit={submit}>
        <label className="field">
          <span className="field-label-lg">{t('noteModal.body')}</span>
          <textarea className="input input-xl" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </form>
    </Modal>
  )
}
