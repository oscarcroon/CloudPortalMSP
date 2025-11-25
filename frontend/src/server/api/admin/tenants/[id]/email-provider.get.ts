import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import {
  getProviderTenantEmailProviderSummary,
  getDistributorTenantEmailProviderSummary
} from '../../../../utils/emailProvider'
import { requireTenantPermission } from '../../../../utils/rbac'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  if (tenant.type === 'provider') {
    const provider = await getProviderTenantEmailProviderSummary(tenantId)
    return { provider }
  } else if (tenant.type === 'distributor') {
    const provider = await getDistributorTenantEmailProviderSummary(tenantId)
    return { provider }
  } else {
    throw createError({ statusCode: 400, message: 'Email provider settings are only available for providers and distributors' })
  }
})

