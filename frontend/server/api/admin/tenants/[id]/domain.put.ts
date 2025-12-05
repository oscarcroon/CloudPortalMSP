import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { ensureBrandableTenant } from './branding/utils'

const payloadSchema = z.object({
  customDomain: z.string().max(255).optional().nullable()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }
  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const tenant = await ensureBrandableTenant(tenantId)
  const body = payloadSchema.parse(await readBody(event))
  const normalizedDomain = normalizeDomain(body.customDomain)

  const db = getDb()
  await db
    .update(tenants)
    .set({
      customDomain: normalizedDomain,
      customDomainVerificationStatus: normalizedDomain ? 'unverified' : 'unverified',
      customDomainVerifiedAt: null,
      updatedAt: new Date()
    })
    .where(eq(tenants.id, tenant.id))

  return {
    tenantId: tenant.id,
    customDomain: normalizedDomain,
    customDomainVerificationStatus: normalizedDomain ? 'unverified' : 'unverified',
    customDomainVerifiedAt: null
  }
})

function normalizeDomain(value?: string | null) {
  if (!value) {
    return null
  }
  let domain = value.trim().toLowerCase()
  if (!domain) {
    return null
  }
  domain = domain.replace(/^https?:\/\//, '')
  domain = domain.split('/')[0] ?? ''
  domain = domain.split('?')[0] ?? ''
  domain = domain.replace(/:\d+$/, '')
  domain = domain.replace(/\.$/, '')

  if (!domain || !/^[a-z0-9.-]+$/.test(domain)) {
    throw createError({ statusCode: 400, message: 'Ogiltigt domännamn.' })
  }

  return domain
}

