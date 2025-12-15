import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '~~/server/utils/db'
import { requirePermission } from '~~/server/utils/rbac'
import { getModuleById } from '~/lib/modules'
import { getEffectiveModulePolicyForOrg } from '~~/server/utils/modulePolicy'
import { orgGroupModulePermissions } from '~~/server/database/schema'
import type { ModuleId } from '~/constants/modules'

type GroupAssignment = {
  groupId: string
  grants?: string[]
  denies?: string[]
}

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const moduleId = getRouterParam(event, 'moduleId') as ModuleId

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }
  if (!moduleId) {
    throw createError({ statusCode: 400, message: 'Missing module ID' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const moduleDef = getModuleById(moduleId)
  if (!moduleDef) {
    throw createError({ statusCode: 404, message: `Module not found: ${moduleId}` })
  }

  const body = (await readBody(event)) as { assignments?: GroupAssignment[] }
  const assignments = Array.isArray(body?.assignments) ? body.assignments : []
  if (!assignments.length) {
    return { updated: 0 }
  }

  const policy = await getEffectiveModulePolicyForOrg(orgId, moduleId)
  const allowed = new Set(
    policy.allowedPermissions && policy.allowedPermissions.length > 0
      ? policy.allowedPermissions
      : moduleDef.requiredPermissions ?? []
  )

  const db = getDb()
  let updated = 0

  for (const assignment of assignments) {
    const grantList = Array.from(new Set((assignment.grants ?? []).filter((p) => allowed.has(p))))
    const denyList = Array.from(new Set((assignment.denies ?? []).filter((p) => allowed.has(p))))

    // Clear existing rows for this group + module
    await db
      .delete(orgGroupModulePermissions)
      .where(
        and(
          eq(orgGroupModulePermissions.organizationId, orgId),
          eq(orgGroupModulePermissions.groupId, assignment.groupId),
          eq(orgGroupModulePermissions.moduleKey, moduleId)
        )
      )

    const rows = [
      ...grantList.map((permissionKey) => ({
        organizationId: orgId,
        groupId: assignment.groupId,
        moduleKey: moduleId,
        permissionKey,
        effect: 'grant' as const
      })),
      ...denyList.map((permissionKey) => ({
        organizationId: orgId,
        groupId: assignment.groupId,
        moduleKey: moduleId,
        permissionKey,
        effect: 'deny' as const
      }))
    ]

    if (rows.length) {
      await db.insert(orgGroupModulePermissions).values(rows as any)
      updated += rows.length
    }
  }

  return { updated }
})




