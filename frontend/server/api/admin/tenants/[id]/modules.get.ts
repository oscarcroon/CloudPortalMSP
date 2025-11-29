import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getTenantModulePolicy } from '~~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { getDb } from '~~/server/utils/db'
import { tenants, distributorProviders } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'
import type { ModuleId, ModuleRoleKey } from '~/constants/modules'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  // Require tenant:manage permission
  await requireTenantPermission(event, 'tenants:manage', tenantId)

  // Get all modules
  const modules = getAllModules()

  // Get tenant to check if it's a provider and has a distributor
  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  // Get policies for each module
  const policies = await Promise.all(
    modules.map(async (module) => {
      const policy = await getTenantModulePolicy(tenantId, module.id)
      
      // Check distributor-level enabled/disabled status if tenant is a provider
      let distributorLevelEnabled = true
      let distributorLevelDisabled = false
      let parentRolesBlocked = false
      let parentRolesSource: 'distributor' | null = null
      let parentAllowedRoles: ModuleRoleKey[] | null = null
      
      if (tenant?.type === 'provider') {
        // Check distributor policy
        const [link] = await db
          .select()
          .from(distributorProviders)
          .where(eq(distributorProviders.providerId, tenantId))
        
        if (link) {
          const distributorPolicy = await getTenantModulePolicy(link.distributorId, module.id)
          if (distributorPolicy) {
            if (!distributorPolicy.enabled) {
              distributorLevelEnabled = false
            }
            if (distributorPolicy.disabled) {
              distributorLevelDisabled = true
            }

            if (distributorPolicy.allowedRoles !== null) {
              parentAllowedRoles = distributorPolicy.allowedRoles
              parentRolesSource = 'distributor'
              if (Array.isArray(distributorPolicy.allowedRoles) && distributorPolicy.allowedRoles.length === 0) {
                parentRolesBlocked = true
              }
            }
          }
        }
      }
      
      // If policy is null, default is enabled: true
      return {
        moduleId: module.id,
        module: {
          id: module.id,
          name: module.name,
          description: module.description,
          category: module.category,
          permissions: module.permissions,
          icon: module.icon
        },
        enabled: policy === null ? true : policy.enabled,
        disabled: policy === null ? false : policy.disabled,
        permissionOverrides: policy?.permissionOverrides ?? {},
        allowedRoles: policy?.allowedRoles ?? null,
        parentRolesBlocked,
        parentRolesSource,
        parentAllowedRoles,
        visibilityMode: module.visibilityMode ?? 'everyone',
        roleDefinitions: module.roles ?? [],
        defaultAllowedRoles: module.defaultAllowedRoles ?? null,
        distributorLevelEnabled, // Whether the module is enabled at distributor level
        distributorLevelDisabled // Whether the module is disabled (grayed out) at distributor level
      }
    })
  )

  return {
    tenantId,
    policies
  }
})

