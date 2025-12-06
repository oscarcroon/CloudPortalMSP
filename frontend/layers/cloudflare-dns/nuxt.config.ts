import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const layerRoot = fileURLToPath(new URL('.', import.meta.url))
const resolveLayer = (...paths: string[]) => resolve(layerRoot, ...paths)

export default defineNuxtConfig({
  alias: {
    '@cloudflare-dns': layerRoot,
    '@cloudflare-dns/server': resolveLayer('server')
  },
  components: [{ path: './components', pathPrefix: false }],
  css: [resolveLayer('assets/css/cloudflare-dns.css')]
})


