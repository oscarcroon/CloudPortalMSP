import { createId } from '@paralleldrive/cuid2'
import { and, eq } from 'drizzle-orm'
import { userModulePermissions } from '../database/schema'
import { getDb } from './db'
import type { ModuleId } from '~/constants/modules'
import type { RbacPermission } from '~/constants/rbac'

type PermissionKey = RbacPermission | string

export interface ModulePermissionOverrides {
  grants: PermissionKey[]
  denies: PermissionKey[]
}

/**
 * Normaliserar inkommande struktur (legacy map eller ny grants/denies) till ett
 * konsekvent objekt.
 */
export const normalizePermissionOverrides = (
  raw: unknown
): ModulePermissionOverrides | null => {
  if (!raw) return null

  // Ny form: { grants: [], denies: [] }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const grants = Array.isArray(obj.grants) ? obj.grants : []
    const denies = Array.isArray(obj.denies) ? obj.denies : []

    const fromEntries = (items: unknown[]) =>
      Array.from(
        new Set(
          items
            .filter((key): key is PermissionKey => typeof key === 'string' && key.trim().length > 0)
            .map((key) => key.trim())
        )
      )

    if (grants.length || denies.length) {
      return {
        grants: fromEntries(grants),
        denies: fromEntries(denies)
      }
    }

    // Legacy map med boolean
    const legacyKeys = Object.entries(obj)
      .filter(([, value]) => typeof value === 'boolean' && value === true)
      .map(([key]) => key)

    if (legacyKeys.length) {
      return { grants: [], denies: Array.from(new Set(legacyKeys)) }
    }
  }

  return null
}

const serializeOverrides = (overrides: ModulePermissionOverrides) =>
  JSON.stringify({
    grants: Array.from(new Set(overrides.grants)),
    denies: Array.from(new Set(overrides.denies))
  })

const filterAllowed = (
  overrides: ModulePermissionOverrides,
  allowedPermissions?: Set<PermissionKey>
): ModulePermissionOverrides => {
  if (!allowedPermissions || allowedPermissions.size === 0) return overrides
  const filter = (keys: PermissionKey[]) =>
    Array.from(new Set(keys.filter((key) => allowedPermissions.has(key))))
  return {
    grants: filter(overrides.grants),
    denies: filter(overrides.denies)
  }
}

/**
 * Get user-specific module permission overrides (grants/denies)
 */
export const getUserModulePermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId
): Promise<ModulePermissionOverrides | null> => {
  const db = getDb()
  const [permission] = await db
    .select()
    .from(userModulePermissions)
    .where(
      and(
        eq(userModulePermissions.organizationId, organizationId),
        eq(userModulePermissions.userId, userId),
        eq(userModulePermissions.moduleId, moduleId)
      )
    )

  if (!permission || !permission.deniedPermissions) {
    return null
  }

  try {
    const parsed = JSON.parse(permission.deniedPermissions) as unknown
    return normalizePermissionOverrides(parsed)
  } catch {
    return null
  }
}

/**
 * Get denied permissions (override) as Set
 */
export const getUserModuleDeniedPermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId
): Promise<Set<PermissionKey> | null> => {
  const overrides = await getUserModulePermissions(organizationId, userId, moduleId)
  if (!overrides || overrides.denies.length === 0) return null
  return new Set(overrides.denies)
}

/**
 * Get all user module permission overrides for an organization
 */
export const getUserModulePermissionsForOrg = async (
  organizationId: string,
  userId: string
): Promise<Map<ModuleId, ModulePermissionOverrides>> => {
  const db = getDb()
  const permissions = await db
    .select()
    .from(userModulePermissions)
    .where(
      and(
        eq(userModulePermissions.organizationId, organizationId),
        eq(userModulePermissions.userId, userId)
      )
    )

  const result = new Map<ModuleId, ModulePermissionOverrides>()

  for (const perm of permissions) {
    if (!perm.deniedPermissions) continue
    try {
      const parsed = JSON.parse(perm.deniedPermissions)
      const normalized = normalizePermissionOverrides(parsed)
      if (normalized) {
        result.set(perm.moduleId as ModuleId, normalized)
      }
    } catch {
      continue
    }
  }

  return result
}

/**
 * Set or update user-specific module permission overrides.
 * If both grants/denies are tomma, posten tas bort (fallback till roll-policy).
 */
export const setUserModulePermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId,
  overrides: ModulePermissionOverrides,
  allowedPermissions?: Set<PermissionKey>
): Promise<void> => {
  const db = getDb()
  const filtered = filterAllowed(overrides, allowedPermissions)

  // Try to find existing permission
  const [existing] = await db
    .select()
    .from(userModulePermissions)
    .where(
      and(
        eq(userModulePermissions.organizationId, organizationId),
        eq(userModulePermissions.userId, userId),
        eq(userModulePermissions.moduleId, moduleId)
      )
    )

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // If overrides are empty, remove record
  if (filtered.grants.length === 0 && filtered.denies.length === 0) {
    if (existing) {
      if (isSqlite) {
        db.delete(userModulePermissions).where(eq(userModulePermissions.id, existing.id)).run()
      } else {
        await db.delete(userModulePermissions).where(eq(userModulePermissions.id, existing.id))
      }
    }
    return
  }

  const payloadJson = serializeOverrides(filtered)

  if (existing) {
    const updateData = {
      deniedPermissions: payloadJson,
      updatedAt: new Date()
    }
    if (isSqlite) {
      db.update(userModulePermissions).set(updateData).where(eq(userModulePermissions.id, existing.id)).run()
    } else {
      await db.update(userModulePermissions).set(updateData).where(eq(userModulePermissions.id, existing.id))
    }
  } else {
    const insertData = {
      id: createId(),
      organizationId,
      userId,
      moduleId,
      deniedPermissions: payloadJson
    }
    if (isSqlite) {
      db.insert(userModulePermissions).values(insertData).run()
    } else {
      await db.insert(userModulePermissions).values(insertData)
    }
  }
}

