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

  // Create maps of module status from DB
  const enabledMap = new Map(dbModules.map((m) => [m.key, m.enabled]))
  const disabledMap = new Map(dbModules.map((m) => [m.key, m.disabled ?? false]))
  const comingSoonMessageMap = new Map(dbModules.map((m) => [m.key, m.comingSoonMessage ?? null]))

  // Get all plugin modules from manifests
  const pluginModules = getAllPluginModules()

  // Merge with DB state (enabled/disabled/comingSoonMessage)
  const allModules = pluginModules.map((module) => ({
    ...module,
    enabled: enabledMap.get(module.key) ?? false,
    disabled: disabledMap.get(module.key) ?? false,
    comingSoonMessage: comingSoonMessageMap.get(module.key) ?? null
  }))

  return {
    modules: allModules
  }
})

