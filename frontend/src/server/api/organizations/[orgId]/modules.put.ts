import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { requirePermission } from '~/server/utils/rbac'
import { setOrganizationModulePolicy, getEffectiveModulePolicyForOrg } from '~/server/utils/modulePolicy'
import { getAllModules } from '~/lib/modules'
import { getDb } from '~/server/utils/db'
import { organizations } from '~/server/database/schema'
import type { ModuleId } from '~/constants/modules'
import type { ModulePermissionOverrides } from '~/server/utils/modulePolicy'

const bodySchema = z.object({
  moduleId: z.string(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional(),
  permissionOverrides: z.record(z.boolean()).optional()
})

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, 'orgId')
  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Missing organization ID' })
  }

  const body = bodySchema.parse(await readBody(event))
  const { moduleId, enabled, disabled, permissionOverrides } = body

  // Require org:manage permission to update module policies
  await requirePermission(event, 'org:manage', orgId)

  // Validate module ID
  const modules = getAllModules()
  const module = modules.find((m) => m.id === moduleId)
  if (!module) {
    throw createError({
      statusCode: 400,
      message: `Invalid module ID: ${moduleId}`
    })
  }

  // Get current effective policy to ensure we're not expanding permissions
  const currentPolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId as ModuleId)
  
  // Get organization and its tenant to check tenant-level policy
  const db = getDb()
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
  
  let tenantLevelEnabled = true // Default to enabled if no tenant
  if (org?.tenantId) {
    const { getTenantModulePolicy } = await import('~/server/utils/modulePolicy')
    const tenantPolicy = await getTenantModulePolicy(org.tenantId, moduleId as ModuleId)
    tenantLevelEnabled = tenantPolicy === null ? true : tenantPolicy.enabled
  }

  // If setting enabled, ensure we're not enabling something that's disabled at tenant level
  if (enabled !== undefined) {
    if (enabled && !tenantLevelEnabled) {
      throw createError({
        statusCode: 403,
        message: 'Cannot enable module that is disabled at tenant level'
      })
    }
  }

  // If setting permission overrides, ensure we're only restricting (not expanding)
  if (permissionOverrides) {
    for (const [permission, value] of Object.entries(permissionOverrides)) {
      if (value === true && currentPolicy.permissionOverrides[permission] === false) {
        throw createError({
          statusCode: 403,
          message: `Cannot enable permission ${permission} that is disabled at tenant level`
        })
      }
    }
  }

  // Update policy
  // If enabled is explicitly set, use it
  // Otherwise, if we're only updating disabled/permissionOverrides, we need to check
  // what the organization's own policy is (not the effective policy which includes tenant)
  const { getOrganizationModulePolicy } = await import('~/server/utils/modulePolicy')
  const orgOwnPolicy = await getOrganizationModulePolicy(orgId, moduleId as ModuleId)
  
  // If enabled is explicitly provided, use it
  // Otherwise, if there's an existing org policy, keep its enabled value
  // If no org policy exists and enabled is not provided, inherit from tenant (which means enabled=true by default)
  let finalEnabled: boolean
  if (enabled !== undefined) {
    finalEnabled = enabled
  } else if (orgOwnPolicy) {
    // Keep existing org policy enabled value
    finalEnabled = orgOwnPolicy.enabled
  } else {
    // No org policy exists, so we inherit from tenant (default enabled=true)
    finalEnabled = tenantLevelEnabled
  }
  
  const finalDisabled = disabled !== undefined ? disabled : (orgOwnPolicy?.disabled ?? false)
  const finalOverrides: ModulePermissionOverrides = {
    ...currentPolicy.permissionOverrides,
    ...(permissionOverrides || {})
  }

  await setOrganizationModulePolicy(orgId, moduleId as ModuleId, finalEnabled, finalOverrides, finalDisabled)

  // Return updated policy
  const updatedPolicy = await getEffectiveModulePolicyForOrg(orgId, moduleId as ModuleId)
  return {
    organizationId: orgId,
    moduleId,
    enabled: updatedPolicy.enabled,
    disabled: updatedPolicy.disabled,
    permissionOverrides: updatedPolicy.permissionOverrides
  }
})

