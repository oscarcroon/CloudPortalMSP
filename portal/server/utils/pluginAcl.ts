import { and, eq, inArray } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from './session'
import { getDb } from './db'
import { orgGroupMembers, orgGroups, pluginAclEntries } from '../database/schema'
import { getOrganizationModulesStatus } from './modulePolicy'
import { getPluginModuleByKey } from '../lib/plugin-registry/registry'

export const PLUGIN_ACL_OPERATIONS = ['create', 'read', 'update', 'delete'] as const
export type PluginAclOperation = (typeof PLUGIN_ACL_OPERATIONS)[number]

export const getUserOrgGroupIds = async (organizationId: string, userId: string) => {
  const db = getDb()
  const rows = await db
    .select({
      groupId: orgGroupMembers.groupId
    })
    .from(orgGroupMembers)
    .leftJoin(orgGroups, eq(orgGroups.id, orgGroupMembers.groupId))
    .where(and(eq(orgGroupMembers.userId, userId), eq(orgGroups.organizationId, organizationId)))

  return rows.map((row) => row.groupId)
}

export const hasPluginPermission = async (
  organizationId: string,
  pluginKey: string,
  operation: PluginAclOperation,
  userGroupIds: string[]
) => {
  if (!userGroupIds.length) {
    return false
  }

  const db = getDb()
  const [row] = await db
    .select({
      id: pluginAclEntries.id
    })
    .from(pluginAclEntries)
    .where(
      and(
        eq(pluginAclEntries.organizationId, organizationId),
        eq(pluginAclEntries.pluginKey, pluginKey),
        eq(pluginAclEntries.operation, operation),
        inArray(pluginAclEntries.groupId, userGroupIds)
      )
    )

  return Boolean(row?.id)
}

export const requirePluginPermission = async (
  event: H3Event,
  pluginKey: string,
  operation: PluginAclOperation,
  organizationIdOverride?: string
) => {
  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const moduleMeta = getPluginModuleByKey(pluginKey)
  if (!moduleMeta) {
    throw createError({ statusCode: 404, message: `Plugin ${pluginKey} finns inte.` })
  }

  const orgId = organizationIdOverride ?? auth.currentOrgId
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Ingen organisation vald' })
  }

  if (auth.user.isSuperAdmin) {
    return { auth, orgId }
  }

  // Kontrollera att modulen är aktiverad och inte blockerad för organisationen
  const orgModules = await getOrganizationModulesStatus(orgId)
  const orgModule = orgModules.find((m) => m.key === pluginKey)
  if (!orgModule || !orgModule.effectiveEnabled) {
    throw createError({ statusCode: 403, message: 'Modulen är inte aktiverad för organisationen' })
  }

  const userGroupIds = await getUserOrgGroupIds(orgId, auth.user.id)
  if (!userGroupIds.length) {
    throw createError({ statusCode: 403, message: 'Ingen gruppåtkomst för pluginet' })
  }

  const allowed = await hasPluginPermission(orgId, pluginKey, operation, userGroupIds)
  if (!allowed) {
    throw createError({ statusCode: 403, message: 'Åtkomst nekad för pluginet' })
  }

  return { auth, orgId }
}

export const upsertPluginAcl = async (params: {
  organizationId: string
  pluginKey: string
  operations: Partial<Record<PluginAclOperation, string[]>>
}) => {
  const db = getDb()
  const { organizationId, pluginKey, operations } = params
  const normalized: Partial<Record<PluginAclOperation, string[]>> = {}

  for (const op of PLUGIN_ACL_OPERATIONS) {
    const groupIds = operations[op] ?? []
    const deduped = Array.from(new Set(groupIds.filter(Boolean)))
    normalized[op] = deduped
  }

  await db
    .delete(pluginAclEntries)
    .where(and(eq(pluginAclEntries.organizationId, organizationId), eq(pluginAclEntries.pluginKey, pluginKey)))

  const rows = PLUGIN_ACL_OPERATIONS.flatMap((op) =>
    (normalized[op] ?? []).map((groupId) => ({
      id: createId(),
      organizationId,
      pluginKey,
      operation: op,
      groupId,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  )

  if (rows.length) {
    await db.insert(pluginAclEntries).values(rows as any)
  }
}


