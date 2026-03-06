/**
 * Layer Auto-Discovery Utility
 *
 * Scans portal/layers/ for directories that qualify as layers.
 * A directory is a top-level layer if it contains module.manifest.ts.
 * A directory has DB tables if it contains server/database/index.ts.
 */

import { readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const layersDir = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]_shared$/, '')

export interface DiscoveredLayer {
  name: string
  path: string
  hasManifest: boolean
  hasSchema: boolean
}

export function discoverLayers(): DiscoveredLayer[] {
  return readdirSync(layersDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && d.name !== 'plugin-template')
    .map(d => ({
      name: d.name,
      path: resolve(layersDir, d.name),
      hasManifest: existsSync(resolve(layersDir, d.name, 'module.manifest.ts')),
      hasSchema: existsSync(resolve(layersDir, d.name, 'server', 'database', 'index.ts'))
    }))
}

/** Top-level layers (have manifests) — these go in nuxt extends */
export function discoverTopLevelLayers(): string[] {
  return discoverLayers()
    .filter(l => l.hasManifest)
    .map(l => `./layers/${l.name}`)
}
