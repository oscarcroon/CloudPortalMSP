import { defineEventHandler } from 'h3'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { getAllPluginModules } from '~~/server/lib/plugin-registry/registry'
import { eq } from 'drizzle-orm'
import { modules } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const db = getDb()
  const dbModules = await db.select().from(modules)

  // Create a map of enabled modules from DB
  const enabledMap = new Map(dbModules.map((m) => [m.key, m.enabled]))

  // Get all plugin modules from manifests
  const pluginModules = getAllPluginModules()

  // Merge with DB state (enabled status)
  const allModules = pluginModules.map((module) => ({
    ...module,
    enabled: enabledMap.get(module.key) ?? false
  }))

  return {
    modules: allModules
  }
})

