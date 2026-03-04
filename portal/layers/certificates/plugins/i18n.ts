import certificatesSv from '../locales/certificates.sv.json'
import certificatesEn from '../locales/certificates.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = nuxtApp.$i18n as { mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void } | undefined

  if (i18n) {
    i18n.mergeLocaleMessage('sv', certificatesSv as unknown as Record<string, unknown>)
    i18n.mergeLocaleMessage('en', certificatesEn as unknown as Record<string, unknown>)
  }
})
