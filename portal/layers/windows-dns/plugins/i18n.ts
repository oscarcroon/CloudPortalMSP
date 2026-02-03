import windowsDnsSv from '../locales/windows-dns.sv.json'
import windowsDnsEn from '../locales/windows-dns.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as { mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void } | undefined

  if (i18n) {
    // Merge windows-dns translations into existing locale messages
    i18n.mergeLocaleMessage('sv', windowsDnsSv as unknown as Record<string, unknown>)
    i18n.mergeLocaleMessage('en', windowsDnsEn as unknown as Record<string, unknown>)
  }
})

