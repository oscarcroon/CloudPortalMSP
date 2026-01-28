import { createError, defineEventHandler, getRouterParam } from 'h3'
import { and, eq, sql } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { orgGroups, pluginAclEntries } from '~~/server/database/schema'
import { getPluginModuleByKey } from '~~/server/lib/plugin-registry/registry'
import { PLUGIN_ACL_OPERATIONS } from '~~/server/utils/pluginAcl'

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

  const db = getDb()

  // Ensure table exists (legacy DBs)
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS plugin_acl_entries (
      id text primary key,
      organization_id text not null,
      plugin_key text not null,
      operation text not null,
      group_id text not null,
      created_at integer,
      updated_at integer
    )
  `)
  const rows = await db
    .select({
      operation: pluginAclEntries.operation,
      groupId: pluginAclEntries.groupId,
      groupName: orgGroups.name
    })
    .from(pluginAclEntries)
    .leftJoin(orgGroups, eq(orgGroups.id, pluginAclEntries.groupId))
    .where(and(eq(pluginAclEntries.organizationId, orgId), eq(pluginAclEntries.pluginKey, pluginKey)))

  const acl: Record<(typeof PLUGIN_ACL_OPERATIONS)[number], { groupId: string; groupName: string | null }[]> =
    {
      create: [],
      read: [],
      update: [],
      delete: []
    }

  for (const row of rows) {
    if (PLUGIN_ACL_OPERATIONS.includes(row.operation as any)) {
      const op = row.operation as (typeof PLUGIN_ACL_OPERATIONS)[number]
      acl[op].push({ groupId: row.groupId, groupName: row.groupName ?? null })
    }
  }

  return {
    organizationId: orgId,
    pluginKey,
    pluginName: plugin.name,
    acl
  }
})


