import { createId } from '@paralleldrive/cuid2'
import { eq, and } from 'drizzle-orm'
import { getDb } from './db'
import { userModulePermissions } from '../database/schema'
import type { ModuleId } from '~/constants/modules'
import type { RbacPermission } from '~/constants/rbac'

/**
 * User module permission denials structure
 * Maps permission names to boolean values (true = denied)
 */
export interface UserModuleDeniedPermissions {
  [permission: string]: boolean
}

/**
 * Get user-specific module permissions for a specific module
 * Returns null if no custom permissions exist (user follows role permissions)
 */
export const getUserModulePermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId
): Promise<UserModuleDeniedPermissions | null> => {
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

  return JSON.parse(permission.deniedPermissions) as UserModuleDeniedPermissions
}

/**
 * Get all denied permissions for a user in an organization
 * Returns a map of moduleId -> Set of denied permissions
 */
export const getUserModuleDeniedPermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId
): Promise<Set<RbacPermission> | null> => {
  const denied = await getUserModulePermissions(organizationId, userId, moduleId)
  if (!denied) {
    return null
  }

  const deniedSet = new Set<RbacPermission>()
  for (const [permission, isDenied] of Object.entries(denied)) {
    if (isDenied) {
      deniedSet.add(permission as RbacPermission)
    }
  }

  return deniedSet.size > 0 ? deniedSet : null
}

/**
 * Get all user module permissions for an organization
 * Returns a map of moduleId -> denied permissions
 */
export const getUserModulePermissionsForOrg = async (
  organizationId: string,
  userId: string
): Promise<Map<ModuleId, Set<RbacPermission>>> => {
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

  const result = new Map<ModuleId, Set<RbacPermission>>()

  for (const perm of permissions) {
    if (!perm.deniedPermissions) {
      continue
    }

    const denied = JSON.parse(perm.deniedPermissions) as UserModuleDeniedPermissions
    const deniedSet = new Set<RbacPermission>()

    for (const [permission, isDenied] of Object.entries(denied)) {
      if (isDenied) {
        deniedSet.add(permission as RbacPermission)
      }
    }

    if (deniedSet.size > 0) {
      result.set(perm.moduleId as ModuleId, deniedSet)
    }
  }

  return result
}

/**
 * Set or update user-specific module permissions
 * If deniedPermissions is empty {}, remove the record (user follows role permissions)
 */
export const setUserModulePermissions = async (
  organizationId: string,
  userId: string,
  moduleId: ModuleId,
  deniedPermissions: UserModuleDeniedPermissions
): Promise<void> => {
  const db = getDb()

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

  // If deniedPermissions is empty, remove the record
  if (Object.keys(deniedPermissions).length === 0) {
    if (existing) {
      if (isSqlite) {
        db.delete(userModulePermissions)
          .where(eq(userModulePermissions.id, existing.id))
          .run()
      } else {
        await db.delete(userModulePermissions).where(eq(userModulePermissions.id, existing.id))
      }
    }
    return
  }

  // Convert to JSON
  const deniedJson = JSON.stringify(deniedPermissions)

  if (existing) {
    // Update existing
    if (isSqlite) {
      db.update(userModulePermissions)
        .set({
          deniedPermissions: deniedJson,
          updatedAt: new Date()
        })
        .where(eq(userModulePermissions.id, existing.id))
        .run()
    } else {
      await db
        .update(userModulePermissions)
        .set({
          deniedPermissions: deniedJson,
          updatedAt: new Date()
        })
        .where(eq(userModulePermissions.id, existing.id))
    }
  } else {
    // Create new
    if (isSqlite) {
      db.insert(userModulePermissions).values({
        id: createId(),
        organizationId,
        userId,
        moduleId,
        deniedPermissions: deniedJson
      }).run()
    } else {
      await db.insert(userModulePermissions).values({
        id: createId(),
        organizationId,
        userId,
        moduleId,
        deniedPermissions: deniedJson
      })
    }
  }
}

