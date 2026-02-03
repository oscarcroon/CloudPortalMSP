import windowsDnsRedirectsSv from '../locales/windows-dns-redirects.sv.json'
import windowsDnsRedirectsEn from '../locales/windows-dns-redirects.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as { mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void } | undefined

  if (i18n) {
    // Merge windows-dns-redirects translations into existing locale messages
    i18n.mergeLocaleMessage('sv', windowsDnsRedirectsSv as unknown as Record<string, unknown>)
    i18n.mergeLocaleMessage('en', windowsDnsRedirectsEn as unknown as Record<string, unknown>)
  }
})

