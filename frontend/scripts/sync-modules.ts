#!/usr/bin/env ts-node
import { getDb, resetDbInstance } from '../server/utils/db'
import { tenantModulePolicies, organizationModulePolicies } from '../server/database/schema'
import { ALL_MODULES } from '../app/lib/module-registry'
import { syncModuleRoles } from '../server/utils/syncModuleRoles'

const main = async () => {
  const db = getDb()
  const moduleKeys = new Set(ALL_MODULES.map((m) => m.key))

  console.log('[sync-modules] syncing module roles/mappings...')
  await syncModuleRoles()
  console.log('[sync-modules] role sync completed')

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





