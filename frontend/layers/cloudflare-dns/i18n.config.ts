import sv from './locales/cloudflare-dns.sv.json'
import en from './locales/cloudflare-dns.en.json'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'sv',
  fallbackLocale: 'sv',
  messages: {
    sv,
    en
  }
}))

