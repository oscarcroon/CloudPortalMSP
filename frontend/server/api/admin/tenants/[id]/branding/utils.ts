import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'

export interface BrandableTenant {
  id: string
  name: string
  type: 'provider' | 'distributor'
}

export async function ensureBrandableTenant(tenantId: string): Promise<BrandableTenant> {
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }

  const db = getDb()
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      type: tenants.type
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const tenant = rows[0]
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  if (tenant.type !== 'provider' && tenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Branding stöds endast för distributörer och leverantörer.'
    })
  }

  return tenant as BrandableTenant
}

