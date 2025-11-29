import { eq, sql, and } from 'drizzle-orm'
import { defineEventHandler, getRouterParam } from 'h3'
import { tenants, distributorProviders, emailProviderProfiles } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { ensureAuthState } from '../../../../utils/session'
import { canAccessTenant } from '../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const distributorId = getRouterParam(event, 'id')
  if (!distributorId) {
    throw createError({ statusCode: 400, message: 'Missing distributor ID' })
  }

  const auth = await ensureAuthState(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const db = getDb()
  const [distributor] = await db.select().from(tenants).where(eq(tenants.id, distributorId))

  if (!distributor) {
    throw createError({ statusCode: 404, message: 'Distributor not found' })
  }

  if (distributor.type !== 'distributor') {
    throw createError({ statusCode: 400, message: 'Tenant is not a distributor' })
  }

  // Check access
  if (!auth.user.isSuperAdmin) {
    let hasAccess = false
    if (auth.tenantRoles[distributorId]) {
      hasAccess = true
    } else {
      for (const userTenantId of Object.keys(auth.tenantRoles)) {
        if (await canAccessTenant(auth, userTenantId, distributorId)) {
          hasAccess = true
          break
        }
      }
    }

    if (!hasAccess) {
      throw createError({ statusCode: 403, message: 'Access denied to distributor' })
    }
  }

  // Get providers linked to this distributor via junction table
  const providers = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      type: tenants.type,
      parentTenantId: tenants.parentTenantId,
      status: tenants.status,
      createdAt: tenants.createdAt,
      hasEmailOverride: sql<boolean>`(
        select exists(
          select 1
          from ${emailProviderProfiles}
          where ${emailProviderProfiles.tenantId} = ${tenants.id}
          and ${emailProviderProfiles.isActive} = 1
          and ${emailProviderProfiles.targetType} = 'provider'
        )
      )`
    })
    .from(distributorProviders)
    .innerJoin(tenants, eq(tenants.id, distributorProviders.providerId))
    .where(eq(distributorProviders.distributorId, distributorId))

  return providers
})

