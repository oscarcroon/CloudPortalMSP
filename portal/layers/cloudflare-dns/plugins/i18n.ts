import cloudflareDnsSv from '../locales/cloudflare-dns.sv.json'
import cloudflareDnsEn from '../locales/cloudflare-dns.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const { $i18n } = nuxtApp

  if ($i18n) {
    // Merge cloudflare-dns translations into existing locale messages
    $i18n.mergeLocaleMessage('sv', cloudflareDnsSv)
    $i18n.mergeLocaleMessage('en', cloudflareDnsEn)
  }
})

