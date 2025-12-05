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

  for (const manifest of manifests) {
    const { module, permissions, roles, roleDefaults } = manifest

    await db
      .insert(modules)
      .values({
        key: module.key,
        name: module.name,
        description: module.description ?? null,
        category: module.category ?? null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: modules.key,
        set: {
          name: module.name,
          description: module.description ?? null,
          category: module.category ?? null,
          updatedAt: new Date()
        }
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


