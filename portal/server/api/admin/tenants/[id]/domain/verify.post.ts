import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { tenants } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { rateLimiters } from '~~/server/utils/rateLimit'
import { ensureBrandableTenant } from '../branding/utils'
import {
  verifyDomainOwnership,
  buildVerificationRecordName,
  buildVerificationRecordValue
} from '~~/server/utils/domain-verification'
import { syncTraefikDomainsIfEnabled } from '~~/server/utils/traefik-domains-config'

export default defineEventHandler(async (event) => {
  // Apply rate limiting for domain verification
  await rateLimiters.domainVerification(event)
  
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant-id krävs.' })
  }
  await requireTenantPermission(event, 'tenants:manage', tenantId)
  const tenant = await ensureBrandableTenant(tenantId)

  const db = getDb()
  const rows = await db
    .select({
      customDomain: tenants.customDomain,
      customDomainVerificationToken: tenants.customDomainVerificationToken,
      customDomainVerificationStatus: tenants.customDomainVerificationStatus,
      customDomainVerifiedAt: tenants.customDomainVerifiedAt
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
  
  // Check that there's a verification token
  if (!record.customDomainVerificationToken) {
    throw createError({
      statusCode: 400,
      message: 'Ingen verifieringstoken finns. Konfigurera om domänen för att generera en ny token.'
    })
  }
  
  // Already verified?
  if (record.customDomainVerificationStatus === 'verified') {
    return {
      tenantId: tenant.id,
      customDomain: record.customDomain,
      customDomainVerificationStatus: 'verified',
      customDomainVerifiedAt: record.customDomainVerifiedAt?.toISOString() ?? null,
      message: 'Domänen är redan verifierad.'
    }
  }
  
  // Update status to verifying
  await db
    .update(tenants)
    .set({
      customDomainVerificationStatus: 'verifying',
      updatedAt: new Date()
    })
    .where(eq(tenants.id, tenant.id))
  
  // Perform DNS verification
  const result = await verifyDomainOwnership(
    record.customDomain,
    record.customDomainVerificationToken
  )
  
  if (result.verified) {
    const verifiedAt = new Date()
    await db
      .update(tenants)
      .set({
        customDomainVerificationStatus: 'verified',
        customDomainVerifiedAt: verifiedAt,
        updatedAt: verifiedAt
      })
      .where(eq(tenants.id, tenant.id))

    // Sync Traefik configuration (runs in background, errors are logged but don't fail the request)
    syncTraefikDomainsIfEnabled().then(syncResult => {
      if (syncResult.synced) {
        console.log(`[domain-verify] Traefik synced after tenant domain verification: ${record.customDomain}`)
      } else if (syncResult.error) {
        console.warn(`[domain-verify] Traefik sync warning: ${syncResult.error}`)
      }
    }).catch(err => {
      console.error('[domain-verify] Traefik sync error:', err)
    })

    return {
      tenantId: tenant.id,
      customDomain: record.customDomain,
      customDomainVerificationStatus: 'verified',
      customDomainVerifiedAt: verifiedAt.toISOString(),
      message: 'Domänen har verifierats!'
    }
  } else {
    // Verification failed - update status back to pending
    await db
      .update(tenants)
      .set({
        customDomainVerificationStatus: 'pending',
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenant.id))
    
    return {
      tenantId: tenant.id,
      customDomain: record.customDomain,
      customDomainVerificationStatus: 'pending',
      customDomainVerifiedAt: null,
      verified: false,
      error: result.error,
      foundRecords: result.foundRecords,
      expected: {
        recordName: buildVerificationRecordName(record.customDomain),
        recordValue: buildVerificationRecordValue(record.customDomainVerificationToken)
      },
      message: 'Verifiering misslyckades. Kontrollera att DNS TXT-posten är korrekt konfigurerad.'
    }
  }
})

