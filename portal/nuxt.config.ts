// https://nuxt.com/docs/api/configuration/nuxt-config
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Auto-discover layers: any dir in layers/ with module.manifest.ts is a top-level layer
const layersScanDir = resolve(__dirname, 'layers')
const discoveredLayers = readdirSync(layersScanDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && d.name !== 'plugin-template')
  .filter(d => existsSync(resolve(layersScanDir, d.name, 'module.manifest.ts')))
  .map(d => `./layers/${d.name}`)

// i18n constants defined inline to avoid importing from app/ directory
// which causes "Vue app aliases are not allowed in server runtime" error in Nitro
const SUPPORTED_LOCALES = [
  { code: 'sv', iso: 'sv-SE', name: 'Svenska' },
  { code: 'en', iso: 'en-US', name: 'English' }
] as const

const DEFAULT_LOCALE = 'sv'

const loginBrandingSlugSuffixes = (process.env.LOGIN_BRANDING_SLUG_SUFFIXES || '.portal.coreit.cloud')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

export default defineNuxtConfig({
  extends: discoveredLayers,
  imports: {
    dirs: ['layers']
  },
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/color-mode', '@nuxtjs/i18n', '@nuxtjs/turnstile'],

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
  turnstile: {
    siteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || ''
  },
  runtimeConfig: {
    turnstile: {
      secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || ''
    },
    auth: {
      // SECURITY: In production, AUTH_JWT_SECRET is required (validated by validate-env plugin).
      // The dev fallback is ONLY for local development and will NOT work in production.
      jwtSecret: process.env.AUTH_JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me'),
      sessionTtl: process.env.AUTH_SESSION_TTL || '12h',
      // SECURITY: In production, AUTH_SERVICE_TOKEN is required (validated by validate-env plugin).
      serviceToken: process.env.AUTH_SERVICE_TOKEN || '',
      cloudflareZeroTrustSecret: process.env.CLOUDFLARE_ZT_JWT_SECRET || '',
      allowSelfRegistration: process.env.AUTH_ALLOW_SELF_REGISTRATION === 'true'
    },
    loginBranding: {
      slugSuffixes: loginBrandingSlugSuffixes,
      allowUnverifiedCustomDomains: process.env.LOGIN_BRANDING_ALLOW_UNVERIFIED === 'true'
    },
    public: {
      apiBase: '/api',
      appName: 'Cloud Portal',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      loginBranding: {
        slugSuffixes: loginBrandingSlugSuffixes
      }
    }
  },
  nitro: {
    compatibilityDate: '2025-11-29',
    alias: {
      '~~/layers': resolve(__dirname, 'layers')
    },
    routeRules: {
      '/api/uploads/logos/**': {
        headers: { 'cache-control': 'public, max-age=31536000' }
      }
    },
    typescript: {
      tsConfig: {
        include: [
          '../layers/*/server/**/*'
        ]
      }
    }
  },
  pinia: {},
  i18n: {
    strategy: 'no_prefix',
    // Relativ till srcDir (app/): går upp en nivå till frontend/ och sedan in i i18n/locales
    langDir: '../i18n/locales',
    // lazy option removed in v10 - lazy loading is now always enabled by default
    defaultLocale: DEFAULT_LOCALE,
    locales: SUPPORTED_LOCALES.map((locale) => ({
      ...locale,
      file: `${locale.code}.json`
    })),
    vueI18n: './i18n.config.ts',
    compilation: {
      strictMessage: false
    }
  },
  typescript: {
    typeCheck: false,
    strict: true
  }
})

