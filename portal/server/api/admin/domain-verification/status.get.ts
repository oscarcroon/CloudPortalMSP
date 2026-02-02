/**
 * GET /api/admin/domain-verification/status
 * 
 * Get status of all custom domains (for super admins)
 */
import { defineEventHandler, createError } from 'h3'
import { eq, isNotNull, sql } from 'drizzle-orm'
import { tenants, organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { ensureAuthState } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  
  if (!auth?.user.isSuperAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Endast superadmins kan se domänverifieringsstatus.'
    })
  }
  
  const db = getDb()
  
  // Get all tenants with custom domains
  const tenantDomains = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      type: tenants.type,
      customDomain: tenants.customDomain,
      verificationStatus: tenants.customDomainVerificationStatus,
      verifiedAt: tenants.customDomainVerifiedAt
    })
    .from(tenants)
    .where(isNotNull(tenants.customDomain))
  
  // Get all organizations with custom domains
  const orgDomains = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      tenantId: organizations.tenantId,
      customDomain: organizations.customDomain,
      verificationStatus: organizations.customDomainVerificationStatus,
      verifiedAt: organizations.customDomainVerifiedAt
    })
    .from(organizations)
    .where(isNotNull(organizations.customDomain))
  
  // Calculate stats
  const allDomains = [
    ...tenantDomains.map(t => ({ ...t, entityType: 'tenant' as const })),
    ...orgDomains.map(o => ({ ...o, entityType: 'organization' as const }))
  ]
  
  const stats = {
    total: allDomains.length,
    verified: allDomains.filter(d => d.verificationStatus === 'verified').length,
    pending: allDomains.filter(d => d.verificationStatus === 'pending').length,
    verifying: allDomains.filter(d => d.verificationStatus === 'verifying').length,
    unverified: allDomains.filter(d => d.verificationStatus === 'unverified').length
  }
  
  return {
    stats,
    tenants: tenantDomains.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      type: t.type,
      customDomain: t.customDomain,
      verificationStatus: t.verificationStatus,
      verifiedAt: t.verifiedAt?.toISOString() ?? null
    })),
    organizations: orgDomains.map(o => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      tenantId: o.tenantId,
      customDomain: o.customDomain,
      verificationStatus: o.verificationStatus,
      verifiedAt: o.verifiedAt?.toISOString() ?? null
    }))
  }
})
