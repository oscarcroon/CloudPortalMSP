import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES } from '~/constants/i18n'
import { useAuth } from '~/composables/useAuth'

const resolveHeaderLocale = (acceptLanguage?: string | string[] | null) => {
  if (!acceptLanguage) {
    return null
  }
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage
  const candidate = raw?.split(',')?.[0]?.slice(0, 2)?.toLowerCase()
  return candidate ?? null
}

export default defineNuxtPlugin(async (nuxtApp) => {
  const auth = useAuth()
  const supportedCodes = new Set(SUPPORTED_LOCALE_CODES)
  const i18n = nuxtApp.$i18n as unknown as { setLocale: (locale: any) => Promise<void> }

  let targetLocale = DEFAULT_LOCALE
  const userLocale = auth.user.value?.locale

  if (userLocale && supportedCodes.has(userLocale)) {
    targetLocale = userLocale
  } else if (import.meta.client && typeof navigator !== 'undefined') {
    const browserLocale = navigator.language?.slice(0, 2)?.toLowerCase()
    if (browserLocale && supportedCodes.has(browserLocale as any)) {
      targetLocale = browserLocale as any
    }
  } else if (import.meta.server) {
    const acceptLanguage = nuxtApp.ssrContext?.event?.node?.req.headers['accept-language'] ?? null
    const headerLocale = resolveHeaderLocale(acceptLanguage)
    if (headerLocale && supportedCodes.has(headerLocale as any)) {
      targetLocale = headerLocale as any
    }
  }

  await i18n.setLocale(targetLocale)
})

