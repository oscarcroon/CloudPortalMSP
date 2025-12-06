import { eq } from 'drizzle-orm'
import { manifests } from '../../../layers/plugin-manifests'
import {
  modules,
  modulePermissions,
  moduleRoles,
  moduleRolePermissions,
  moduleRoleDefaults
} from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export async function syncPluginRegistry() {
  const db = getDb()

  // Check if enabled column exists by trying to query it
  let hasEnabledColumn = false
  try {
    await db.execute('SELECT enabled FROM modules LIMIT 1')
    hasEnabledColumn = true
  } catch {
    // Column doesn't exist yet, migration hasn't run
    hasEnabledColumn = false
  }

  for (const manifest of manifests) {
    const { module, permissions, roles, roleDefaults } = manifest

    // Check if module already exists to preserve enabled status
    let existing: { enabled?: boolean } | undefined
    if (hasEnabledColumn) {
      const [row] = await db.select().from(modules).where(eq(modules.key, module.key))
      existing = row
    }

    const baseValues: any = {
      key: module.key,
      name: module.name,
      description: module.description ?? null,
      category: module.category ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Only include enabled if column exists
    if (hasEnabledColumn) {
      baseValues.enabled = existing?.enabled ?? false
    }

    const updateValues: any = {
      name: module.name,
      description: module.description ?? null,
      category: module.category ?? null,
      updatedAt: new Date()
    }

    // Only include enabled in update if column exists
    if (hasEnabledColumn) {
      updateValues.enabled = existing?.enabled ?? false
    }

    await db
      .insert(modules)
      .values(baseValues)
      .onConflictDoUpdate({
        target: modules.key,
        set: updateValues
      })

    await db.delete(modulePermissions).where(eq(modulePermissions.moduleKey, module.key))

    if (permissions.length > 0) {
      await db.insert(modulePermissions).values(
        permissions.map((permission) => ({
          moduleKey: module.key,
          permissionKey: permission.key,
          description: permission.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      )
    }

    await db.delete(moduleRoles).where(eq(moduleRoles.moduleId, module.key))

    if (roles.length > 0) {
      await db.insert(moduleRoles).values(
        roles.map((role, index) => ({
          moduleId: module.key,
          roleKey: role.key,
          roleName: role.label,
          description: role.description ?? null,
          capabilities: null,
          sortOrder: role.sortOrder ?? (index + 1) * 10,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      )
    }

    await db.delete(moduleRolePermissions).where(eq(moduleRolePermissions.moduleKey, module.key))

    const rolePermRows =
      roles?.flatMap((role) =>
        role.permissions.map((permissionKey) => ({
          moduleKey: module.key,
          roleKey: role.key,
          permissionKey,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      ) ?? []

    if (rolePermRows.length > 0) {
      await db.insert(moduleRolePermissions).values(rolePermRows)
    }

    await db.delete(moduleRoleDefaults).where(eq(moduleRoleDefaults.moduleKey, module.key))

    if (roleDefaults.length > 0) {
      await db.insert(moduleRoleDefaults).values(
        roleDefaults.map((item) => ({
          moduleKey: module.key,
          appRoleKey: item.appRoleKey,
          moduleRoleKey: item.moduleRoleKey,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      )
    }
  }
}


