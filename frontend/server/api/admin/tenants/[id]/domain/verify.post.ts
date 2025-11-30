import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from '../branding/utils'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }
  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const tenant = await ensureBrandableTenant(tenantId)

  const db = getDb()
  const rows = await db
    .select({
      customDomain: tenants.customDomain
    })
    .from(tenants)
    .where(eq(tenants.id, tenant.id))
    .limit(1)

  const record = rows[0]
  if (!record?.customDomain) {
    throw createError({
      statusCode: 400,
      message: 'Ingen custom domain är konfigurerad för denna tenant.'
    })
  }

  const verifiedAt = new Date()
  await db
    .update(tenants)
    .set({
      customDomainVerificationStatus: 'verified',
      customDomainVerifiedAt: verifiedAt,
      updatedAt: verifiedAt
    })
    .where(eq(tenants.id, tenant.id))

  return {
    tenantId: tenant.id,
    customDomain: record.customDomain,
    customDomainVerificationStatus: 'verified',
    customDomainVerifiedAt: verifiedAt.toISOString()
  }
})

