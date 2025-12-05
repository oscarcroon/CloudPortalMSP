import { syncPluginRegistry } from '~~/server/lib/plugin-registry/sync'

/**
 * Nitro plugin that runs plugin-registry sync at server start.
 * We avoid importing nitropack helpers to keep it runtime-safe.
 */
export default async () => {
  try {
    await syncPluginRegistry()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[plugin-registry] Sync failed', error)
  }
}


