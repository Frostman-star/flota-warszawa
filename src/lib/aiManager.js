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

export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const maxWidth = 1200
      const scale = Math.min(maxWidth / img.width, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      resolve(base64)
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => reject(new Error('Image compression failed'))
    img.src = URL.createObjectURL(file)
  })
}

function parseJsonFromClaudeText(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) {
      try {
        return JSON.parse(fenced.trim())
      } catch {
        return null
      }
    }
    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    if (!objectMatch) return null
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      return null
    }
  }
}

export async function analyzeDocument({ base64Image, mediaType = 'image/jpeg' }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: getClaudeHeaders(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            {
              type: 'text',
              text: `Przeanalizuj ten dokument samochodowy i wyciągnij wszystkie dostępne informacje.

Szukaj następujących danych:

- Typ dokumentu (ubezpieczenie OC/AC, dowód rejestracyjny, przegląd techniczny, faktura serwisowa)
- Data ważności / data wygaśnięcia
- Numer polisy lub rejestracji
- Marka i model pojazdu
- Numer rejestracyjny pojazdu
- Właściciel pojazdu
- Kwota (jeśli faktura)
- Nazwa firmy ubezpieczeniowej lub warsztatu

Odpowiedz TYLKO w formacie JSON bez żadnego dodatkowego tekstu:
{
  "document_type": "insurance_oc|insurance_ac|registration|technical_inspection|service_invoice|other",
  "expiry_date": "YYYY-MM-DD or null",
  "policy_number": "string or null",
  "plate_number": "string or null",
  "car_make": "string or null",
  "car_model": "string or null",
  "owner_name": "string or null",
  "amount": "number or null",
  "company_name": "string or null",
  "confidence": "high|medium|low",
  "notes": "any other relevant info"
}`,
            },
          ],
        },
      ],
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error: ${response.status} ${body}`)
  }
  const payload = await response.json()
  const text = extractClaudeText(payload)
  const parsed = parseJsonFromClaudeText(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('DOCUMENT_PARSE_FAILED')
  return {
    document_type: parsed.document_type ?? 'other',
    expiry_date: parsed.expiry_date ?? null,
    policy_number: parsed.policy_number ?? null,
    plate_number: parsed.plate_number ?? null,
    car_make: parsed.car_make ?? null,
    car_model: parsed.car_model ?? null,
    owner_name: parsed.owner_name ?? null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : parsed.amount ? Number(parsed.amount) : null,
    company_name: parsed.company_name ?? null,
    confidence: parsed.confidence ?? 'low',
    notes: parsed.notes ?? '',
  }
}
