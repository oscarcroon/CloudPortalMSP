import { defineEventHandler, createError } from 'h3'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { syncPluginRegistry } from '~~/server/lib/plugin-registry/sync'
import { getDb } from '~~/server/utils/db'

// Simple in-memory mutex to prevent concurrent syncs
let syncInProgress = false
let lastSyncTime = 0
const MIN_SYNC_INTERVAL_MS = 60000 // 1 minute rate limit

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  // Rate limit check
  const now = Date.now()
  if (now - lastSyncTime < MIN_SYNC_INTERVAL_MS) {
    throw createError({
      statusCode: 429,
      message: `Resync kan bara köras en gång per minut. Försök igen om ${Math.ceil((MIN_SYNC_INTERVAL_MS - (now - lastSyncTime)) / 1000)} sekunder.`
    })
  }

  // Mutex check
  if (syncInProgress) {
    throw createError({
      statusCode: 409,
      message: 'En resync pågår redan. Vänta tills den är klar.'
    })
  }

  try {
    syncInProgress = true
    lastSyncTime = now

    const result = await syncPluginRegistry()

    return {
      success: true,
      result: {
        modulesUpdated: result.modulesUpdated,
        permissionsAdded: result.permissionsAdded,
        permissionsRemoved: result.permissionsRemoved,
        permissionsReactivated: result.permissionsReactivated
      }
    }
  } catch (error) {
    console.error('[admin/modules/resync] Sync failed:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Resync misslyckades'
    })
  } finally {
    syncInProgress = false
  }
})
