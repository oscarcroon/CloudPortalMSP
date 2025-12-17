import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, inArray } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { tenants, distributorProviders } from '~~/server/database/schema'

/**
 * Get distributors linked to a provider tenant
 * GET /api/admin/tenants/:id/distributors
 */
export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()

  // Verify tenant exists and is a provider
  const [tenant] = await db
    .select({ id: tenants.id, type: tenants.type })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  if (tenant.type !== 'provider') {
    // Return empty list for non-providers
    return { distributors: [] }
  }

  // Get linked distributors
  const links = await db
    .select({
      distributorId: distributorProviders.distributorId
    })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, tenantId))

  if (links.length === 0) {
    return { distributors: [] }
  }

  // Fetch distributor details
  const distributorIds = links.map((l) => l.distributorId)
  
  const linkedDistributors = await db
    .select({
      id: tenants.id,
      name: tenants.name
    })
    .from(tenants)
    .where(inArray(tenants.id, distributorIds))

  return {
    distributors: linkedDistributors.map((d) => ({
      id: d.id,
      name: d.name
    }))
  }
})
