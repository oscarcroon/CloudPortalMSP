import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { modulePermissions } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { getModuleById } from '~/lib/modules'
import type { ModuleId } from '~/constants/modules'
import { manifests } from '../../../../layers/plugin-manifests'

export default defineEventHandler(async (event) => {
  const moduleId = getRouterParam(event, 'moduleId') as ModuleId

  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Missing module ID' })
  }

  const moduleDef = getModuleById(moduleId)
  if (!moduleDef) {
    throw createError({ statusCode: 404, message: `Module not found: ${moduleId}` })
  }

  const db = getDb()
  const dbPermissions = await db
    .select({
      permissionKey: modulePermissions.permissionKey,
      description: modulePermissions.description
    })
    .from(modulePermissions)
    .where(eq(modulePermissions.moduleKey, moduleId))

  const manifest = manifests.find((m) => m.module.key === moduleId)
  const manifestPermissionMap = new Map(
    (manifest?.permissions ?? []).map((perm) => [perm.key, perm.description ?? null])
  )

  const permissionKeys =
    moduleDef.requiredPermissions && moduleDef.requiredPermissions.length > 0
      ? moduleDef.requiredPermissions
      : dbPermissions.map((p) => p.permissionKey as string)

  const permissions = permissionKeys.map((key) => {
    const manifestDescription = manifestPermissionMap.get(key) ?? null
    const dbDescription = dbPermissions.find((p) => p.permissionKey === key)?.description ?? null
    return {
      key,
      description: manifestDescription ?? dbDescription
    }
  })

  return {
    module: {
      key: moduleDef.key,
      name: moduleDef.name,
      description: moduleDef.description,
      category: moduleDef.category,
      icon: moduleDef.icon ?? null
    },
    permissions,
    roles: moduleDef.roles ?? [],
    roleDefaults: manifest?.rbacDefaults ?? {}
  }
})


