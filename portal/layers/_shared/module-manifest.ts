import type { PluginModuleManifest } from '~~/server/lib/plugin-registry/types'

/**
 * Shared helper för layers så manifest får typstöd och enkel wrapper.
 */
export const definePluginManifest = (manifest: PluginModuleManifest) => manifest

export type { PluginModuleManifest }


