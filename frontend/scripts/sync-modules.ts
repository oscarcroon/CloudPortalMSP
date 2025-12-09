#!/usr/bin/env ts-node
import { getDb, resetDbInstance } from '../server/utils/db'
import {
  tenantModulePolicies,
  organizationModulePolicies,
  moduleRoles,
  moduleRolePermissions,
  moduleRoleDefaults,
  memberModuleRoleOverrides
} from '../server/database/schema'
import { ALL_MODULES } from '../app/lib/module-registry'
import { syncModuleRoles } from '../server/utils/syncModuleRoles'
import { syncPluginRegistry } from '../server/lib/plugin-registry/sync'

const main = async () => {
  const db = getDb()
  const moduleKeys = new Set(ALL_MODULES.map((m) => m.key))

  console.log('[sync-modules] syncing plugin registry (modules/permissions/roles)...')
  await syncPluginRegistry()
  console.log('[sync-modules] registry sync completed')

  // Legacy modulroller: logga kvarvarande data
  const legacyRoles = await db.select().from(moduleRoles)
  const legacyRolePerms = await db.select().from(moduleRolePermissions)
  const legacyRoleDefaults = await db.select().from(moduleRoleDefaults)
  const legacyOverrides = await db.select().from(memberModuleRoleOverrides)

  if (legacyRoles.length || legacyRolePerms.length || legacyRoleDefaults.length || legacyOverrides.length) {
    console.warn('[sync-modules] Legacy module role data still present:')
    console.warn('  moduleRoles:', legacyRoles.length)
    console.warn('  moduleRolePermissions:', legacyRolePerms.length)
    console.warn('  moduleRoleDefaults:', legacyRoleDefaults.length)
    console.warn('  memberModuleRoleOverrides:', legacyOverrides.length)
    console.warn('  -> Planera migrering till permissions-tabeller och rensa roll-tabeller.')
  } else {
    console.log('[sync-modules] Inga legacy module role-poster kvar.')
  }

  console.log('[sync-modules] checking orphan module policies...')
  const [tenantPolicies, orgPolicies] = await Promise.all([
    db.select().from(tenantModulePolicies),
    db.select().from(organizationModulePolicies)
  ])

  const orphanTenants = tenantPolicies.filter((row) => !moduleKeys.has(row.moduleId))
  const orphanOrgs = orgPolicies.filter((row) => !moduleKeys.has(row.moduleId))

  if (orphanTenants.length) {
    console.warn('[sync-modules] Orphan tenant policies:', orphanTenants.length)
    orphanTenants.forEach((row) =>
      console.warn(' - tenant', row.tenantId, 'moduleId', row.moduleId)
    )
  }
  if (orphanOrgs.length) {
    console.warn('[sync-modules] Orphan org policies:', orphanOrgs.length)
    orphanOrgs.forEach((row) => console.warn(' - org', row.organizationId, 'moduleId', row.moduleId))
  }

  console.log('[sync-modules] done')
}

main()
  .catch((err) => {
    console.error('[sync-modules] failed', err)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })






