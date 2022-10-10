import { LocaleData } from './types'

// https://en.wikipedia.org/wiki/Right-to-left
// prettier-ignore
const RTL_SCRIPTS = new Set(['Arab', 'Syrc', 'Samr', 'Mand', 'Thaa', 'Mend', 'Nkoo', 'Adlm', 'Rohg', 'Hebr'])
// prettier-ignore
const RTL_LANGS = new Set(['ae', 'ar', 'arc', 'bcc', 'bqi', 'ckb', 'dv', 'fa', 'glk', 'he', 'ku', 'mzn', 'nqo', 'pnb', 'ps', 'sd', 'ug', 'ur', 'yi'])

export function getLocaleData(locale: string): LocaleData {
  // @ts-ignore
  if (Intl.Locale) {
    // @ts-ignore
    const { region, script, language } = new Intl.Locale(locale).maximize()
    const direction = RTL_SCRIPTS.has(script || '') ? 'rtl' : 'ltr'

    return {
      locale,
      language,
      region: region || '',
      direction,
      isRTL: direction === 'rtl',
    }
  }

  // NOTE: region может быть undefined, если в navigator.language будет `ru` или `en`
  const [language, region] = locale.split('-')
  const direction = RTL_LANGS.has(language) ? 'rtl' : 'ltr'

  return {
    locale,
    language,
    region,
    direction,
    isRTL: direction === 'rtl',
  }
}
