import sv from './locales/windows-dns.sv.json'
import en from './locales/windows-dns.en.json'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'sv',
  fallbackLocale: 'sv',
  messages: {
    sv,
    en
  }
}))

