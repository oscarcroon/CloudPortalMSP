import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and, ne } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, organizations } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { rateLimiters } from '~~/server/utils/rateLimit'
import { ensureBrandableTenant } from './branding/utils'
import {
  normalizeDomain,
  generateDomainVerificationToken,
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'

const payloadSchema = z.object({
  customDomain: z.string().max(255).optional().nullable()
})

export default defineEventHandler(async (event) => {
  // Apply rate limiting for domain registration
  await rateLimiters.domainRegistration(event)
  
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }
  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const tenant = await ensureBrandableTenant(tenantId)
  const body = payloadSchema.parse(await readBody(event))
  const normalizedDomain = normalizeDomain(body.customDomain)

  const db = getDb()
  
  // Store old values for comparison
  const oldDomain = tenant.customDomain
  const domainChanged = normalizedDomain !== oldDomain
  
  // If domain hasn't changed, return current status without modifying anything
  if (!domainChanged) {
    const existingToken = tenant.customDomainVerificationToken
    return {
      tenantId: tenant.id,
      customDomain: tenant.customDomain,
      customDomainVerificationStatus: tenant.customDomainVerificationStatus ?? 'unverified',
      customDomainVerifiedAt: tenant.customDomainVerifiedAt?.toISOString() ?? null,
      verificationInstructions: (tenant.customDomain && existingToken && tenant.customDomainVerificationStatus !== 'verified') ? {
        recordType: 'TXT',
        recordName: buildVerificationRecordName(tenant.customDomain),
        recordValue: buildVerificationRecordValue(existingToken),
        note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
      } : null,
      message: tenant.customDomainVerificationStatus === 'verified' 
        ? 'Domänen är redan verifierad.' 
        : 'Domänen är oförändrad.'
    }
  }
  
  // Check if domain is already used by another tenant
  if (normalizedDomain) {
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.customDomain, normalizedDomain),
          ne(tenants.id, tenant.id)
        )
      )
      .limit(1)
    
    if (existingTenant) {
      throw createError({
        statusCode: 409,
        message: 'Denna domän används redan av en annan leverantör.'
      })
    }
    
    // Also check organizations table
    const [existingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.customDomain, normalizedDomain))
      .limit(1)
    
    if (existingOrg) {
      throw createError({
        statusCode: 409,
        message: 'Denna domän används redan av en organisation.'
      })
    }
  }
  
  // Generate verification token only if setting a NEW domain
  const verificationToken = normalizedDomain ? generateDomainVerificationToken() : null
  
  await db
    .update(tenants)
    .set({
      customDomain: normalizedDomain,
      customDomainVerificationStatus: normalizedDomain ? 'pending' : 'unverified',
      customDomainVerifiedAt: null,
      customDomainVerificationToken: verificationToken,
      updatedAt: new Date()
    })
    .where(eq(tenants.id, tenant.id))

  return {
    tenantId: tenant.id,
    customDomain: normalizedDomain,
    customDomainVerificationStatus: normalizedDomain ? 'pending' : 'unverified',
    customDomainVerifiedAt: null,
    verificationInstructions: normalizedDomain && verificationToken ? {
      recordType: 'TXT',
      recordName: buildVerificationRecordName(normalizedDomain),
      recordValue: buildVerificationRecordValue(verificationToken),
      note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
    } : null
  }
})

