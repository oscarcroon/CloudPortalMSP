import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb } from '~~/server/utils/db'
import type { WindowsDnsOrgConfig } from './types'

// Import schema - assumes CloudPortalMSP has a windowsDnsOrgConfig table
// This will need to be created in the main app's schema
// For now, we'll use a generic plugin config approach

/**
 * Get Windows DNS org config from database
 */
export const getOrgConfig = async (orgId: string): Promise<WindowsDnsOrgConfig | null> => {
  const db = getDb()

  // Try to get from plugin_configs table (generic approach)
  // This assumes CloudPortalMSP has a generic plugin config storage
  try {
    const result = await db.execute({
      sql: `SELECT config_data FROM plugin_configs WHERE organization_id = ? AND plugin_key = 'windows-dns' LIMIT 1`,
      args: [orgId]
    })

    if (!result.rows?.length) return null

    const row = result.rows[0] as { config_data: string }
    const config = JSON.parse(row.config_data) as WindowsDnsOrgConfig

    return config
  } catch {
    // Table might not exist yet, return null
    return null
  }
}

/**
 * Save Windows DNS org config to database
 */
export const saveOrgConfig = async (
  orgId: string,
  config: Partial<WindowsDnsOrgConfig>
): Promise<WindowsDnsOrgConfig> => {
  const db = getDb()
  const now = new Date()

  // Get existing config
  const existing = await getOrgConfig(orgId)

  const merged: WindowsDnsOrgConfig = {
    instanceId: config.instanceId ?? existing?.instanceId ?? null,
    windowsDnsAccountId: config.windowsDnsAccountId ?? existing?.windowsDnsAccountId ?? null,
    coreId: config.coreId ?? existing?.coreId ?? null,
    lastValidatedAt: config.lastValidatedAt ?? existing?.lastValidatedAt ?? null,
    lastSyncAt: config.lastSyncAt ?? existing?.lastSyncAt ?? null,
    lastSyncStatus: config.lastSyncStatus ?? existing?.lastSyncStatus ?? null,
    lastSyncError: config.lastSyncError ?? existing?.lastSyncError ?? null
  }

  const configJson = JSON.stringify(merged)

  try {
    if (existing) {
      await db.execute({
        sql: `UPDATE plugin_configs SET config_data = ?, updated_at = ? WHERE organization_id = ? AND plugin_key = 'windows-dns'`,
        args: [configJson, now.toISOString(), orgId]
      })
    } else {
      await db.execute({
        sql: `INSERT INTO plugin_configs (id, organization_id, plugin_key, config_data, created_at, updated_at) VALUES (?, ?, 'windows-dns', ?, ?, ?)`,
        args: [createId(), orgId, configJson, now.toISOString(), now.toISOString()]
      })
    }
  } catch (err) {
    console.error('[windows-dns] Failed to save org config:', err)
    throw err
  }

  return merged
}

/**
 * Update Windows DNS account ID after ensure operation
 */
export const setWindowsDnsAccountId = async (orgId: string, accountId: string): Promise<void> => {
  await saveOrgConfig(orgId, { windowsDnsAccountId: accountId })
}

/**
 * Delete Windows DNS org config
 */
export const deleteOrgConfig = async (orgId: string): Promise<void> => {
  const db = getDb()

  try {
    await db.execute({
      sql: `DELETE FROM plugin_configs WHERE organization_id = ? AND plugin_key = 'windows-dns'`,
      args: [orgId]
    })
  } catch (err) {
    console.error('[windows-dns] Failed to delete org config:', err)
  }
}

/**
 * Get masked org config for display (no sensitive data)
 */
export const getMaskedOrgConfig = async (orgId: string) => {
  const config = await getOrgConfig(orgId)
  if (!config) return null

  return {
    instanceId: config.instanceId,
    windowsDnsAccountId: config.windowsDnsAccountId,
    coreId: config.coreId,
    lastValidatedAt: config.lastValidatedAt,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    // Note: No sensitive data is stored in org-config for Windows DNS
    // LayerToken (WINDOWS_DNS_LAYER_TOKEN) is server-only env var
    // API URL (WINDOWS_DNS_API_URL) is server-only env var
  }
}

