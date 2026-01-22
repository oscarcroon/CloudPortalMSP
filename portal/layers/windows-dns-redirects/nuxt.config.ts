/**
 * Windows DNS Redirects Layer - Nuxt Configuration
 * This layer provides redirect management functionality for the Windows DNS module
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const layerDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  // Layer-specific configuration
  alias: {
    // IMPORTANT: Use absolute paths so Nitro/Rollup can resolve extensions correctly.
    '@windows-dns-redirects': layerDir,
    '@windows-dns-redirects/server': resolve(layerDir, 'server'),
  },

  // Auto-import components from this layer
  components: [
    {
      path: resolve(layerDir, 'components'),
      prefix: '',
    },
  ],

  // Include layer-specific CSS if needed
  // css: ['./assets/css/windows-dns-redirects.css'],
})
