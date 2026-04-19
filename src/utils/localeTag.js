/** BCP 47 tag for dates/currency formatting from i18next language code. */
export function localeTag(lang) {
  if (lang === 'pl') return 'pl-PL'
  if (lang === 'uk') return 'uk-UA'
  if (lang === 'ru') return 'ru-RU'
  return 'en-GB'
}
