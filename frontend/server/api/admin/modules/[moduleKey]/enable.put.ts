import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { getPluginModuleByKey } from '~~/server/lib/plugin-registry/registry'
import { eq } from 'drizzle-orm'
import { modules } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { syncPluginRegistry } from '~~/server/lib/plugin-registry/sync'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const moduleKey = getRouterParam(event, 'moduleKey')
  if (!moduleKey) {
    throw createError({ statusCode: 400, message: 'Missing module key' })
  }

  const body = await readBody<{ enabled?: boolean; disabled?: boolean; comingSoonMessage?: string | null }>(event)
  const enabled = body.enabled ?? true
  const disabled = body.disabled ?? false
  const comingSoonMessage = body.comingSoonMessage ?? null

  // Verify module exists in manifests
  const pluginModule = getPluginModuleByKey(moduleKey)
  if (!pluginModule) {
    throw createError({ statusCode: 404, message: `Module ${moduleKey} not found in plugin manifests` })
  }

  const db = getDb()

  // Ensure module is synced to DB first
  await syncPluginRegistry()

  // Update enabled status
  await db
    .update(modules)
    .set({
      enabled,
      disabled,
      comingSoonMessage,
      updatedAt: new Date()
    })
    .where(eq(modules.key, moduleKey))

  const [updated] = await db.select().from(modules).where(eq(modules.key, moduleKey))

  return {
    key: updated.key,
    name: updated.name,
    enabled: updated.enabled,
    disabled: updated.disabled,
    comingSoonMessage: updated.comingSoonMessage
  }
})

