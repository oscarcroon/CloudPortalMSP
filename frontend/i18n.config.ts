import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES } from './app/constants/i18n'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  availableLocales: SUPPORTED_LOCALE_CODES
}))

