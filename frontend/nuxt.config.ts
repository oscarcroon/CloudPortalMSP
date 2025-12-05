// https://nuxt.com/docs/api/configuration/nuxt-config
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './app/constants/i18n'

const backendApiBase = process.env.API_BASE || 'http://localhost:4000/api'
const backendProxyBase = backendApiBase
const loginBrandingSlugSuffixes = (process.env.LOGIN_BRANDING_SLUG_SUFFIXES || '.portal.coreit.cloud')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

export default defineNuxtConfig({
  extends: ['./layers/windows-dns'],
  imports: {
    dirs: ['layers']
  },
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/color-mode', '@nuxtjs/i18n'],
  css: ['~/assets/css/tailwind.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },
  colorMode: {
    classSuffix: '',
    storageKey: 'color-theme-preference',
    preference: 'system',
    fallback: 'light',
    storage: 'cookie'
  },
  tailwindcss: {
    viewer: false
  },
  runtimeConfig: {
    auth: {
      jwtSecret: process.env.AUTH_JWT_SECRET || 'dev-secret-change-me',
      sessionTtl: process.env.AUTH_SESSION_TTL || '12h',
      serviceToken: process.env.AUTH_SERVICE_TOKEN || '',
      cloudflareZeroTrustSecret: process.env.CLOUDFLARE_ZT_JWT_SECRET || '',
      allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true'
    },
    loginBranding: {
      slugSuffixes: loginBrandingSlugSuffixes,
      allowUnverifiedCustomDomains: process.env.LOGIN_BRANDING_ALLOW_UNVERIFIED === 'true'
    },
    apiBase: backendApiBase,
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/backend',
      appName: 'Cloud Portal',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      loginBranding: {
        slugSuffixes: loginBrandingSlugSuffixes
      }
    }
  },
  nitro: {
    compatibilityDate: '2025-11-29',
    devProxy: {
      '/backend': {
        target: process.env.NUXT_DEV_PROXY_API || backendProxyBase,
        changeOrigin: true
      }
    },
    routeRules: {
      '/backend/**': {
        proxy: `${backendProxyBase}/**`
      },
      '/api/uploads/logos/**': {
        headers: { 'cache-control': 'public, max-age=31536000' }
      }
    }
  },
  pinia: {},
  i18n: {
    strategy: 'no_prefix',
    langDir: 'locales',
    defaultLocale: DEFAULT_LOCALE,
    locales: SUPPORTED_LOCALES.map((locale) => ({
      ...locale,
      file: `${locale.code}.json`
    })),
    vueI18n: './i18n.config.ts'
  },
  typescript: {
    typeCheck: false,
    strict: true
  }
})

