import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  alias: {
    '@windows-dns': './'
  },
  components: [
    // Auto-register layer components without prefixed directory segments
    { path: './components', pathPrefix: false }
  ]
})

