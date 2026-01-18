/**
 * Windows DNS Redirects Layer - Nuxt Configuration
 * This layer provides redirect management functionality for the Windows DNS module
 */
export default defineNuxtConfig({
  // Layer-specific configuration
  alias: {
    '@windows-dns-redirects': './layers/windows-dns-redirects',
    '@windows-dns-redirects/server': './layers/windows-dns-redirects/server',
  },

  // Auto-import components from this layer
  components: [
    {
      path: './components',
      prefix: '',
    },
  ],

  // Include layer-specific CSS if needed
  // css: ['./assets/css/windows-dns-redirects.css'],
})
