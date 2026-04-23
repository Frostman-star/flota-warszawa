const DOC_FIELDS = ['insurance_expiry', 'oc_expiry', 'ac_expiry', 'przeglad_expiry', 'last_service_date']

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildAlertsFromCars(cars = []) {
  const now = new Date()
  const out = []
  for (const car of cars) {
    for (const field of DOC_FIELDS) {
      const raw = car?.[field]
      const dt = parseDate(raw)
      if (!dt) continue
      const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days <= 30) {
        out.push({
          vehicle_id: car.id,
          plate_number: car.plate_number,
          model: car.model,
          field,
          value: raw,
          days_until: days,
        })
      }
    }
  }
  return out.sort((a, b) => a.days_until - b.days_until)
}

export function getClaudeHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const apiKey =
    import.meta.env.VITE_ANTHROPIC_API_KEY ||
    import.meta.env.VITE_CLAUDE_API_KEY ||
    import.meta.env.ANTHROPIC_API_KEY
  const version = import.meta.env.VITE_ANTHROPIC_VERSION || '2023-06-01'
  if (apiKey) headers['x-api-key'] = apiKey
  headers['anthropic-version'] = version
  return headers
}

export async function callClaudeMessages({ systemPrompt, messages, maxTokens = 1000 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: getClaudeHeaders(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error: ${response.status} ${body}`)
  }
  return response.json()
}

export function extractClaudeText(payload) {
  const blocks = payload?.content
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b) => b?.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim()
}

export function extractTrailingAction(text) {
  if (!text || typeof text !== 'string') return { cleanText: text ?? '', action: null }
  const match = text.match(/(\{[\s\S]*"action"[\s\S]*\})\s*$/)
  if (!match) return { cleanText: text.trim(), action: null }
  const jsonRaw = match[1]
  try {
    const action = JSON.parse(jsonRaw)
    const cleanText = text.slice(0, match.index).trim()
    return { cleanText, action }
  } catch {
    return { cleanText: text.trim(), action: null }
  }
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}
