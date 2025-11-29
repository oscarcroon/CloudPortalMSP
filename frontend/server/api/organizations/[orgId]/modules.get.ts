import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requirePermission } from '~~/server/utils/rbac'
import { getEffectiveModulePolicyForOrg, getTenantModulePolicy } from '~~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { getDb } from '~~/server/utils/db'
import { organizations, tenants, distributorProviders } from '~~/server/database/schema'
import { eq } from 'drizzle-orm'
import type { ModuleId } from '~/constants/modules'

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  // Require org:manage permission to view module policies
  await requirePermission(event, 'org:manage', orgId)

  // Get all modules
  const modules = getAllModules()

  // Get organization and its tenant to check tenant-level enabled status
  const db = getDb()
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
  
  // Get effective policies for each module
  const policies = await Promise.all(
    modules.map(async (module) => {
      const policy = await getEffectiveModulePolicyForOrg(orgId, module.id)
      
      // Check tenant-level enabled/disabled status to determine if organization can manage the module
      let tenantLevelEnabled = true
      let tenantLevelDisabled = false
      if (org?.tenantId) {
        const [orgTenant] = await db.select().from(tenants).where(eq(tenants.id, org.tenantId))
        
        if (orgTenant) {
          let tenantPolicy = null
          
          // If tenant is a provider, check both distributor and provider policies
          if (orgTenant.type === 'provider') {
            // Check distributor policy
            const [link] = await db
              .select()
              .from(distributorProviders)
              .where(eq(distributorProviders.providerId, orgTenant.id))
            
            if (link) {
              const distributorPolicy = await getTenantModulePolicy(link.distributorId, module.id)
              if (distributorPolicy) {
                if (!distributorPolicy.enabled) {
                  tenantLevelEnabled = false
                }
                if (distributorPolicy.disabled) {
                  tenantLevelDisabled = true
                }
              }
            }
            
            // Check provider policy
            tenantPolicy = await getTenantModulePolicy(orgTenant.id, module.id)
          } else if (orgTenant.type === 'distributor') {
            tenantPolicy = await getTenantModulePolicy(orgTenant.id, module.id)
          }
          
          // If tenant policy exists, check enabled and disabled status
          if (tenantPolicy) {
            if (!tenantPolicy.enabled) {
              tenantLevelEnabled = false
            }
            if (tenantPolicy.disabled) {
              tenantLevelDisabled = true
            }
          }
        }
      }
      
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
        enabled: policy.enabled,
        disabled: policy.disabled,
        permissionOverrides: policy.permissionOverrides,
        tenantLevelEnabled, // Whether the module is enabled at tenant level
        tenantLevelDisabled // Whether the module is disabled (grayed out) at tenant level
      }
    })
  )

  return {
    organizationId: orgId,
    policies
  }
})

