import windowsDnsRedirectsSv from '../locales/windows-dns-redirects.sv.json'
import windowsDnsRedirectsEn from '../locales/windows-dns-redirects.en.json'

export default defineNuxtPlugin((nuxtApp) => {
  const { $i18n } = nuxtApp

  if ($i18n) {
    // Merge windows-dns-redirects translations into existing locale messages
    $i18n.mergeLocaleMessage('sv', windowsDnsRedirectsSv)
    $i18n.mergeLocaleMessage('en', windowsDnsRedirectsEn)
  }
})

