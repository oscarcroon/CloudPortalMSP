import windowsDnsSv from '../locales/windows-dns.sv.json'
import windowsDnsEn from '../locales/windows-dns.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const { $i18n } = nuxtApp

  if ($i18n) {
    // Merge windows-dns translations into existing locale messages
    $i18n.mergeLocaleMessage('sv', windowsDnsSv)
    $i18n.mergeLocaleMessage('en', windowsDnsEn)
  }
})

