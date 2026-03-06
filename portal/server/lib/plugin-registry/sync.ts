import { eq, and, sql } from 'drizzle-orm'
import { manifests } from '../../../layers/plugin-manifests'
import { modules, modulePermissions } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export interface SyncResult {
  modulesUpdated: number
  permissionsAdded: number
  permissionsRemoved: number
  permissionsReactivated: number
}

export async function syncPluginRegistry(): Promise<SyncResult> {
  const db = getDb()

  const uniqueManifests = Array.from(new Map(manifests.map((manifest) => [manifest.module.key, manifest])).values())

  // Check if enabled column exists by trying to query it
  let hasEnabledColumn = false
  let hasLifecycleColumns = false
  try {
    await db.execute(sql`SELECT enabled FROM modules LIMIT 1`)
    hasEnabledColumn = true
  } catch {
    hasEnabledColumn = false
  }

  try {
    await db.execute(sql`SELECT is_active, status, removed_at FROM module_permissions LIMIT 1`)
    hasLifecycleColumns = true
  } catch {
    hasLifecycleColumns = false
  }

  let modulesUpdated = 0
  let permissionsAdded = 0
  let permissionsRemoved = 0
  let permissionsReactivated = 0

  for (const manifest of uniqueManifests) {
    const { module, permissions } = manifest

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
      .onDuplicateKeyUpdate({
        set: updateValues
      })

    modulesUpdated++

    // Get existing permissions for this module
    const existingPermissions = await db
      .select()
      .from(modulePermissions)
      .where(eq(modulePermissions.moduleKey, module.key))

    const existingPermMap = new Map(
      existingPermissions.map((p) => [`${p.moduleKey}:${p.permissionKey}`, p])
    )

    // Build set of current manifest permissions
    const manifestPermKeys = new Set(permissions.map((p) => p.key))
    const manifestPermMap = new Map(permissions.map((p) => [p.key, p]))

    const now = new Date()

    if (hasLifecycleColumns) {
      // New approach: mark removed instead of delete
      // 1. Mark permissions that no longer exist in manifest as removed
      for (const existingPerm of existingPermissions) {
        if (!manifestPermKeys.has(existingPerm.permissionKey)) {
          // Permission removed from manifest
          if (existingPerm.isActive || existingPerm.status === 'active') {
            await db
              .update(modulePermissions)
              .set({
                isActive: false,
                status: 'removed',
                removedAt: now,
                updatedAt: now
              })
              .where(
                and(
                  eq(modulePermissions.moduleKey, module.key),
                  eq(modulePermissions.permissionKey, existingPerm.permissionKey)
                )
              )
            permissionsRemoved++
          }
        } else {
          // Permission exists in manifest - reactivate if it was removed
          if (!existingPerm.isActive || existingPerm.status === 'removed') {
            const manifestPerm = manifestPermMap.get(existingPerm.permissionKey)
            await db
              .update(modulePermissions)
              .set({
                isActive: true,
                status: 'active',
                removedAt: null,
                description: manifestPerm?.description ?? existingPerm.description,
                updatedAt: now
              })
              .where(
                and(
                  eq(modulePermissions.moduleKey, module.key),
                  eq(modulePermissions.permissionKey, existingPerm.permissionKey)
                )
              )
            permissionsReactivated++
          } else {
            // Update description if changed
            const manifestPerm = manifestPermMap.get(existingPerm.permissionKey)
            if (manifestPerm?.description !== existingPerm.description) {
              await db
                .update(modulePermissions)
                .set({
                  description: manifestPerm?.description ?? null,
                  updatedAt: now
                })
                .where(
                  and(
                    eq(modulePermissions.moduleKey, module.key),
                    eq(modulePermissions.permissionKey, existingPerm.permissionKey)
                  )
                )
            }
          }
        }
      }

      // 2. Insert new permissions from manifest
      for (const permission of permissions) {
        const key = `${module.key}:${permission.key}`
        if (!existingPermMap.has(key)) {
          await db.insert(modulePermissions).values({
            moduleKey: module.key,
            permissionKey: permission.key,
            description: permission.description ?? null,
            isActive: true,
            status: 'active',
            removedAt: null,
            createdAt: now,
            updatedAt: now
          })
          permissionsAdded++
        }
      }
    } else {
      // Legacy approach: delete and recreate (for backwards compatibility during migration)
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
        permissionsAdded += permissions.length
      }
    }
  }

  return {
    modulesUpdated,
    permissionsAdded,
    permissionsRemoved,
    permissionsReactivated
  }
}
