export const SUPPORTED_LOCALES = [
  { code: 'sv', iso: 'sv-SE', name: 'Svenska' },
  { code: 'en', iso: 'en-US', name: 'English' }
] as const

export const DEFAULT_LOCALE = 'sv'

export type SupportedLocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

export const SUPPORTED_LOCALE_CODES: SupportedLocaleCode[] = SUPPORTED_LOCALES.map(
  (locale) => locale.code
) as SupportedLocaleCode[]

