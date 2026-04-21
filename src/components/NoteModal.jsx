import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

const NOTE_TEMPLATES = [
  {
    key: 'service',
    fields: ['serviceDate', 'mileage', 'issue', 'workDone', 'cost', 'nextStep'],
  },
  {
    key: 'engineRepair',
    fields: ['serviceDate', 'mileage', 'issue', 'parts', 'workDone', 'cost', 'nextStep'],
  },
  {
    key: 'tires',
    fields: ['serviceDate', 'mileage', 'issue', 'workDone', 'cost', 'nextStep'],
  },
  {
    key: 'accident',
    fields: ['serviceDate', 'mileage', 'issue', 'workDone', 'cost', 'nextStep'],
  },
  {
    key: 'plannedMaintenance',
    fields: ['serviceDate', 'mileage', 'workDone', 'cost', 'nextStep'],
  },
]

/**
 * @param {{ open: boolean, onClose: () => void, onSave: (text: string) => Promise<void> }} props
 */
export function NoteModal({ open, onClose, onSave }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [templateKey, setTemplateKey] = useState('')

  useEffect(() => {
    if (open) {
      setText('')
      setTemplateKey('')
    }
  }, [open])

  function buildTemplateText(nextTemplateKey) {
    const tpl = NOTE_TEMPLATES.find((entry) => entry.key === nextTemplateKey)
    if (!tpl) return ''
    const lines = [t(`noteModal.templates.${tpl.key}.title`)]
    for (const fieldKey of tpl.fields) {
      lines.push(`${t(`noteModal.templates.fields.${fieldKey}`)}:`)
    }
    return lines.join('\n')
  }

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
          <span className="field-label-lg">{t('noteModal.templateLabel')}</span>
          <select
            className="input input-xl"
            value={templateKey}
            onChange={(e) => {
              const nextTemplateKey = e.target.value
              setTemplateKey(nextTemplateKey)
              if (nextTemplateKey) {
                setText(buildTemplateText(nextTemplateKey))
              }
            }}
          >
            <option value="">{t('noteModal.templateNone')}</option>
            {NOTE_TEMPLATES.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>
                {t(`noteModal.templates.${tpl.key}.label`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label-lg">{t('noteModal.body')}</span>
          <textarea className="input input-xl" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </form>
    </Modal>
  )
}
