import { createError, defineEventHandler, readBody } from 'h3'
import { eq, and, ne } from 'drizzle-orm'
import { z } from 'zod'
import { organizations, tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { logOrganizationAction } from '~~/server/utils/audit'
import { rateLimiters } from '~~/server/utils/rateLimit'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  requireOrganizationManageAccess
} from '../utils'
import { generateDomainVerificationToken, normalizeDomain } from '~~/server/utils/domain-verification'

const payloadSchema = z.object({
  customDomain: z.string().max(255).optional().nullable()
})

export default defineEventHandler(async (event) => {
  // Apply rate limiting for domain registration
  await rateLimiters.domainRegistration(event)
  const orgParam = parseOrgParam(event)
  const db = getDb()
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // Validate access - requires tenants:manage permission or super admin
  await requireOrganizationManageAccess(event, organization)
  
  const body = payloadSchema.parse(await readBody(event))
  const normalizedDomain = normalizeDomain(body.customDomain)
  
  // Check if domain is already used by another organization
  if (normalizedDomain) {
    const [existingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.customDomain, normalizedDomain),
          ne(organizations.id, organization.id)
        )
      )
      .limit(1)
    
    if (existingOrg) {
      throw createError({
        statusCode: 409,
        message: 'Denna domän används redan av en annan organisation.'
      })
    }
    
    // Also check tenants table
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.customDomain, normalizedDomain))
      .limit(1)
    
    if (existingTenant) {
      throw createError({
        statusCode: 409,
        message: 'Denna domän används redan av en leverantör.'
      })
    }
  }
  
  // Store old values for audit
  const oldDomain = organization.customDomain
  
  // Generate verification token if setting a new domain
  const verificationToken = normalizedDomain ? generateDomainVerificationToken() : null
  
  await db
    .update(organizations)
    .set({
      customDomain: normalizedDomain,
      customDomainVerificationStatus: normalizedDomain ? 'pending' : 'unverified',
      customDomainVerifiedAt: null,
      customDomainVerificationToken: verificationToken,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, organization.id))
  
  // Log audit event
  if (normalizedDomain !== oldDomain) {
    await logOrganizationAction(event, 'ORGANIZATION_CUSTOM_DOMAIN_UPDATED', {
      changedFields: {
        customDomain: { old: oldDomain, new: normalizedDomain }
      }
    }, organization.id)
  }
  
  return {
    organizationId: organization.id,
    customDomain: normalizedDomain,
    customDomainVerificationStatus: normalizedDomain ? 'pending' : 'unverified',
    customDomainVerifiedAt: null,
    verificationToken: verificationToken,
    verificationInstructions: normalizedDomain ? {
      recordType: 'TXT',
      recordName: `_cloudportal-verify.${normalizedDomain}`,
      recordValue: `cp-verify=${verificationToken}`,
      note: 'Lägg till denna TXT-post i din DNS för att verifiera domänägandeskap.'
    } : null
  }
})
