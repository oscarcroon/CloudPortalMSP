// https://nuxt.com/docs/api/configuration/nuxt-config
const backendApiBase = process.env.API_BASE || 'http://localhost:4000/api'
const backendProxyBase = backendApiBase

export default defineNuxtConfig({
  srcDir: 'src/',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/tailwind.css'],
  app: {
    head: {
      script: [
        {
          key: 'theme-preload',
          innerHTML:
            "(function(){try{var k='color-theme-preference';var p=localStorage.getItem(k);if(!p||p==='system'){p=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(p==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();",
          tagPosition: 'head'
        }
      ],
      dangerouslyDisableSanitizers: ['script']
    }
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
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
    apiBase: backendApiBase,
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/backend',
      appName: 'Cloud Portal'
    }
  },
  nitro: {
    devProxy: {
      '/backend': {
        target: process.env.NUXT_DEV_PROXY_API || backendProxyBase,
        changeOrigin: true
      }
    },
    routeRules: {
      '/backend/**': {
        proxy: `${backendProxyBase}/**`
      }
    }
  },
  pinia: {},
  typescript: {
    typeCheck: false,
    strict: true
  }
})

