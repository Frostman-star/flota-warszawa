import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import pl from './locales/pl.json'
import uk from './locales/uk.json'
import en from './locales/en.json'
import ru from './locales/ru.json'

const STORAGE_KEY = 'flota_lang'
const supported = ['pl', 'uk', 'en', 'ru']

const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
const lng = supported.includes(stored || '') ? stored : 'pl'

i18n.use(initReactI18next).init({
  resources: { pl: { translation: pl }, uk: { translation: uk }, en: { translation: en }, ru: { translation: ru } },
  lng,
  fallbackLng: 'pl',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lang) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lang)
  }
})

export const LANG_OPTIONS = [
  { code: 'pl', flag: '🇵🇱' },
  { code: 'uk', flag: '🇺🇦' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'ru', flag: '🇷🇺' },
]

export default i18n
