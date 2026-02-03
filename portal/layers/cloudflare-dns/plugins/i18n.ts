import cloudflareDnsSv from '../locales/cloudflare-dns.sv.json'
import cloudflareDnsEn from '../locales/cloudflare-dns.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as { mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void } | undefined

  if (i18n) {
    // Merge cloudflare-dns translations into existing locale messages
    i18n.mergeLocaleMessage('sv', cloudflareDnsSv as unknown as Record<string, unknown>)
    i18n.mergeLocaleMessage('en', cloudflareDnsEn as unknown as Record<string, unknown>)
  }
})

