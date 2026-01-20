#!/usr/bin/env ts-node
/**
 * Migrerar legacy modulroller till permissions-tabeller (grants).
 * Körs en gång; idempotent i den meningen att den inte raderar legacy-rader,
 * men skriver permissions grants (utan att duplicera).
 */
import { and, eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import {
  moduleRoles,
  moduleRolePermissions,
  memberModuleRoleOverrides,
  groupModulePermissions,
  userModulePermissions
} from '../server/database/schema'
import { getDb, resetDbInstance } from '../server/utils/db'
import { manifests } from '../layers/plugin-manifests'

type PermissionKey = string

const buildRolePermissionMap = async (moduleKey: string): Promise<Map<string, PermissionKey[]>> => {
  const db = getDb()
  const permMap = new Map<string, PermissionKey[]>()
  const rows = await db
    .select({
      roleKey: moduleRolePermissions.roleKey,
      permissionKey: moduleRolePermissions.permissionKey
    })
    .from(moduleRolePermissions)
    .where(eq(moduleRolePermissions.moduleKey, moduleKey))
  for (const row of rows) {
    if (!permMap.has(row.roleKey)) permMap.set(row.roleKey, [])
    permMap.get(row.roleKey)!.push(row.permissionKey)
  }
  return permMap
}

const migrateUserOverrides = async (moduleKey: string, legacy: Map<string, PermissionKey[]>) => {
  const db = getDb()
  const overrides = await db
    .select()
    .from(memberModuleRoleOverrides)
    .where(eq(memberModuleRoleOverrides.moduleId, moduleKey))

  for (const ov of overrides) {
    const perms = new Set<PermissionKey>()
    const rolePerms = legacy.get(ov.roleKey) ?? []
    for (const p of rolePerms) perms.add(p)

    if (!perms.size) continue

    const deniedJson = JSON.stringify(Object.fromEntries(Array.from(perms).map((p) => [p, 'grant'] as const)))

    const [existing] = await db
      .select({ id: userModulePermissions.id })
      .from(userModulePermissions)
      .where(
        and(
          eq(userModulePermissions.organizationId, ov.organizationId),
          eq(userModulePermissions.userId, ov.userId),
          eq(userModulePermissions.moduleId, moduleKey)
        )
      )

    if (existing) {
      await db
        .update(userModulePermissions)
        .set({ deniedPermissions: deniedJson, updatedAt: new Date() })
        .where(eq(userModulePermissions.id, existing.id))
    } else {
      await db.insert(userModulePermissions).values({
        id: createId(),
        organizationId: ov.organizationId,
        userId: ov.userId,
        moduleId: moduleKey,
        deniedPermissions: deniedJson
      })
    }
  }
}

const migrate = async () => {
  const db = getDb()
  for (const manifest of manifests) {
    const moduleKey = manifest.module.key
    console.log(`[migrate] module ${moduleKey}`)

    const legacyRoles = await db.select().from(moduleRoles).where(eq(moduleRoles.moduleId, moduleKey))
    if (!legacyRoles.length) {
      console.log('  no legacy roles, skip')
      continue
    }

    const rolePermMap = await buildRolePermissionMap(moduleKey)

    // Migrate user overrides
    await migrateUserOverrides(moduleKey, rolePermMap)

    // Note: group-level legacy not included (since we lack mapping). Could be extended if legacy group data exists.
    console.log('  migrated user overrides to permissions (grants).')
  }
}

migrate()
  .catch((err) => {
    console.error('[migrate-legacy-module-roles] failed', err)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })


