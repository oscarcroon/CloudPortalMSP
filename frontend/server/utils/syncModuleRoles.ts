import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { getDb } from './db'
import { moduleRoles, roleModuleRoleMappings } from '../database/schema'
import { getAllModules } from '~/lib/modules'
import type { ModuleRoleDefinition } from '~/constants/modules'
import { rbacModuleRoleDefaults } from '~/constants/moduleRoleMappings'

interface ModuleRoleSnapshot {
  moduleId: string
  roleKey: string
  roleName: string
  description: string | null
  capabilities: string | null
}

const toSnapshot = (moduleId: string, role: ModuleRoleDefinition): ModuleRoleSnapshot => ({
  moduleId,
  roleKey: role.key,
  roleName: role.label,
  description: role.description ?? null,
  capabilities: role.capabilities ? JSON.stringify(role.capabilities) : null
})

export const syncModuleRoles = async (): Promise<void> => {
  const db = getDb()
  const modules = getAllModules()
  const desired = new Map<string, ModuleRoleSnapshot>()

  for (const module of modules) {
    if (!module.roles || module.roles.length === 0) {
      continue
    }

    for (const role of module.roles) {
      const snapshot = toSnapshot(module.id, role)
      desired.set(`${snapshot.moduleId}:${snapshot.roleKey}`, snapshot)
    }
  }

  const existing = await db.select().from(moduleRoles)
  const existingMap = new Map(
    existing.map(role => [`${role.moduleId}:${role.roleKey}`, role])
  )

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  for (const [key, snapshot] of desired) {
    const current = existingMap.get(key)
    if (!current) {
      const row = {
        id: createId(),
        moduleId: snapshot.moduleId,
        roleKey: snapshot.roleKey,
        roleName: snapshot.roleName,
        description: snapshot.description,
        capabilities: snapshot.capabilities
      }

      if (isSqlite) {
        db.insert(moduleRoles).values(row).run()
      } else {
        await db.insert(moduleRoles).values(row)
      }
      continue
    }

    const needsUpdate =
      current.roleName !== snapshot.roleName ||
      current.description !== snapshot.description ||
      (current.capabilities ?? null) !== snapshot.capabilities

    if (needsUpdate) {
      if (isSqlite) {
        db.update(moduleRoles)
          .set({
            roleName: snapshot.roleName,
            description: snapshot.description,
            capabilities: snapshot.capabilities,
            updatedAt: new Date()
          })
          .where(eq(moduleRoles.id, current.id))
          .run()
      } else {
        await db
          .update(moduleRoles)
          .set({
            roleName: snapshot.roleName,
            description: snapshot.description,
            capabilities: snapshot.capabilities,
            updatedAt: new Date()
          })
          .where(eq(moduleRoles.id, current.id))
      }
    }
  }

  for (const role of existing) {
    const key = `${role.moduleId}:${role.roleKey}`
    if (desired.has(key)) {
      continue
    }

    if (isSqlite) {
      db.delete(moduleRoles)
        .where(eq(moduleRoles.id, role.id))
        .run()
    } else {
      await db.delete(moduleRoles).where(eq(moduleRoles.id, role.id))
    }
  }

  await syncRoleMappings()
}

const syncRoleMappings = async () => {
  const db = getDb()
  const desiredKeys = new Set<string>()

  for (const [rbacRole, defaults] of Object.entries(rbacModuleRoleDefaults)) {
    for (const [moduleId, roleKeys] of Object.entries(defaults)) {
      for (const roleKey of roleKeys) {
        desiredKeys.add(`${rbacRole}:${moduleId}:${roleKey}`)
      }
    }
  }

  if (desiredKeys.size === 0) {
    return
  }

  const existing = await db.select().from(roleModuleRoleMappings)
  const existingKeys = new Set(
    existing.map((row) => `${row.rbacRole}:${row.moduleId}:${row.moduleRoleKey}`)
  )

  const rowsToInsert: typeof roleModuleRoleMappings.$inferInsert[] = Array.from(desiredKeys)
    .filter((key) => !existingKeys.has(key))
    .map((key) => key.split(':'))
    .filter(
      (parts): parts is [string, string, string] =>
        parts.length === 3 &&
        typeof parts[0] === 'string' &&
        typeof parts[1] === 'string' &&
        typeof parts[2] === 'string'
    )
    .map(([rbacRole, moduleId, moduleRoleKey]) => ({
      id: createId(),
      rbacRole,
      moduleId,
      moduleRoleKey
    }))

  if (rowsToInsert.length === 0) {
    return
  }

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  if (isSqlite) {
    db.insert(roleModuleRoleMappings).values(rowsToInsert).run()
  } else {
    await db.insert(roleModuleRoleMappings).values(rowsToInsert)
  }
}

