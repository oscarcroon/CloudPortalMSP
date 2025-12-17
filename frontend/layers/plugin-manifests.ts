import type { PluginModuleManifest } from './_shared/module-manifest'
import cloudflareDns from './cloudflare-dns/module.manifest'
import windowsDns from './windows-dns/module.manifest'

export const manifests: PluginModuleManifest[] = [cloudflareDns, windowsDns]



