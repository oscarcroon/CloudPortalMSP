import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  alias: {
    '@example-module': './'
  },
  components: [{ path: './components', pathPrefix: false }]
  // Note: CSS is commented out as this is a template layer, not an active layer
  // When using this template, uncomment and update the CSS path in your new layer's nuxt.config.ts
  // css: ['./assets/css/example-module.css']
})


