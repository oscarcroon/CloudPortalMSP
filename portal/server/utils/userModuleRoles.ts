import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { getDb } from './db'
import { memberModuleRoleOverrides } from '../database/schema'
import type { ModuleId, ModuleRoleKey } from '~/constants/modules'

export interface ModuleRoleOverrideSet {
  grants: Set<ModuleRoleKey>
  denies: Set<ModuleRoleKey>
}

const emptyOverrideSet = (): ModuleRoleOverrideSet => ({
  grants: new Set<ModuleRoleKey>(),
  denies: new Set<ModuleRoleKey>()
})

export const getModuleRoleOverridesForModule = async (
  organizationId: string,
  moduleId: ModuleId
): Promise<Map<string, ModuleRoleOverrideSet>> => {
  const db = getDb()
  const rows = await db
    .select({
      userId: memberModuleRoleOverrides.userId,
      roleKey: memberModuleRoleOverrides.roleKey,
      effect: memberModuleRoleOverrides.effect
    })
    .from(memberModuleRoleOverrides)
    .where(
      and(
        eq(memberModuleRoleOverrides.organizationId, organizationId),
        eq(memberModuleRoleOverrides.moduleId, moduleId)
      )
    )

  const map = new Map<string, ModuleRoleOverrideSet>()

  for (const row of rows) {
    const state = map.get(row.userId) ?? emptyOverrideSet()
    if (row.effect === 'grant') {
      state.grants.add(row.roleKey as ModuleRoleKey)
    } else {
      state.denies.add(row.roleKey as ModuleRoleKey)
    }
    map.set(row.userId, state)
  }

  return map
}

export const getModuleRoleOverridesForMember = async (
  organizationId: string,
  userId: string
): Promise<Map<ModuleId, ModuleRoleOverrideSet>> => {
  const db = getDb()
  const rows = await db
    .select({
      moduleId: memberModuleRoleOverrides.moduleId,
      roleKey: memberModuleRoleOverrides.roleKey,
      effect: memberModuleRoleOverrides.effect
    })
    .from(memberModuleRoleOverrides)
    .where(
      and(
        eq(memberModuleRoleOverrides.organizationId, organizationId),
        eq(memberModuleRoleOverrides.userId, userId)
      )
    )

  const map = new Map<ModuleId, ModuleRoleOverrideSet>()

  for (const row of rows) {
    const moduleId = row.moduleId as ModuleId
    const state = map.get(moduleId) ?? emptyOverrideSet()
    if (row.effect === 'grant') {
      state.grants.add(row.roleKey as ModuleRoleKey)
    } else {
      state.denies.add(row.roleKey as ModuleRoleKey)
    }
    map.set(moduleId, state)
  }

  return map
}

export const setModuleRoleOverridesForModule = async ({
  organizationId,
  userId,
  moduleId,
  grantKeys,
  denyKeys,
  actorUserId
}: {
  organizationId: string
  userId: string
  moduleId: ModuleId
  grantKeys: ModuleRoleKey[]
  denyKeys: ModuleRoleKey[]
  actorUserId?: string
}): Promise<void> => {
  const db = getDb()

  const whereClause = and(
    eq(memberModuleRoleOverrides.organizationId, organizationId),
    eq(memberModuleRoleOverrides.userId, userId),
    eq(memberModuleRoleOverrides.moduleId, moduleId)
  )

  await db.delete(memberModuleRoleOverrides).where(whereClause)

  const rows = [
    ...grantKeys.map(roleKey => ({
      id: createId(),
      organizationId,
      userId,
      moduleId,
      roleKey,
      effect: 'grant' as const,
      createdByUserId: actorUserId ?? null,
      updatedByUserId: actorUserId ?? null
    })),
    ...denyKeys.map(roleKey => ({
      id: createId(),
      organizationId,
      userId,
      moduleId,
      roleKey,
      effect: 'deny' as const,
      createdByUserId: actorUserId ?? null,
      updatedByUserId: actorUserId ?? null
    }))
  ]

  if (rows.length === 0) {
    return
  }

  await db.insert(memberModuleRoleOverrides).values(rows)
}

