import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const layerRoot = fileURLToPath(new URL('.', import.meta.url))
const resolveLayer = (...paths: string[]) => resolve(layerRoot, ...paths)

export default defineNuxtConfig({
  // Extend the redirects sub-layer for redirect management functionality
  extends: ['../windows-dns-redirects'],

  alias: {
    '@windows-dns': layerRoot,
    '@windows-dns/server': resolveLayer('server')
  },
  components: [{ path: './components', pathPrefix: false }],
  css: [resolveLayer('assets/css/windows-dns.css')]
})

