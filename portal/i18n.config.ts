// i18n constants defined directly here to avoid importing from app/ directory
// which causes "Vue app aliases are not allowed in server runtime" error
// These values should match app/constants/i18n.ts

const SUPPORTED_LOCALES = [
  { code: 'sv', iso: 'sv-SE', name: 'Svenska' },
  { code: 'en', iso: 'en-US', name: 'English' }
] as const

const DEFAULT_LOCALE = 'sv'

type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

const SUPPORTED_LOCALE_CODES: SupportedLocaleCode[] = SUPPORTED_LOCALES.map(
  (locale) => locale.code
) as SupportedLocaleCode[]

export default defineI18nConfig(() => ({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  availableLocales: SUPPORTED_LOCALE_CODES
}))
