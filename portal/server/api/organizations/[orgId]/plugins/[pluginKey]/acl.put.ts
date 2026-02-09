import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups } from '~~/server/database/schema'
import { getPluginModuleByKey } from '~~/server/lib/plugin-registry/registry'
import { PLUGIN_ACL_OPERATIONS, upsertPluginAcl } from '~~/server/utils/pluginAcl'

const operationsSchema = z
  .object({
    create: z.array(z.string()).optional(),
    read: z.array(z.string()).optional(),
    update: z.array(z.string()).optional(),
    delete: z.array(z.string()).optional()
  })
  .optional()

const bodySchema = z.object({
  operations: operationsSchema
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  const pluginKey = getRouterParam(event, 'pluginKey')

  if (!orgId || !pluginKey) {
    throw createError({ statusCode: 400, message: 'Missing organization or plugin key' })
  }

  await requirePermission(event, 'org:manage', orgId)

  const plugin = getPluginModuleByKey(pluginKey)
  if (!plugin) {
    throw createError({ statusCode: 404, message: `Plugin ${pluginKey} finns inte` })
  }

  const body = bodySchema.parse(await readBody(event))
  const operations = body.operations ?? {}

  // Hämta alla tillåtna grupper för organisationen
  const db = getDb()

  const groupRows = await db
    .select({ id: orgGroups.id })
    .from(orgGroups)
    .where(eq(orgGroups.organizationId, orgId))

  const validGroupIds = new Set(groupRows.map((g) => g.id))

  const normalized: Record<string, string[]> = {}
  for (const op of PLUGIN_ACL_OPERATIONS) {
    const values = Array.from(new Set(operations[op] ?? [])).filter(Boolean)
    normalized[op] = values
    const invalid = values.filter((id) => !validGroupIds.has(id))
    if (invalid.length) {
      throw createError({
        statusCode: 400,
        message: `Ogiltiga grupp-ID:n för ${op}: ${invalid.join(', ')}`
      })
    }
  }

  await upsertPluginAcl({
    organizationId: orgId,
    pluginKey,
    operations: normalized as any
  })

  return {
    organizationId: orgId,
    pluginKey,
    operations: normalized
  }
})


