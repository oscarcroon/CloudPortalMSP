import { and, eq, inArray, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import {
  distributorProviders,
  organizations,
  tenantMemberships,
  tenants
} from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import { logTenantAction } from '../../../../utils/audit'

export const deleteSchema = z.object({
  confirmSlug: z.string().min(1, 'Ange sluggen för att bekräfta.'),
  acknowledgeImpact: z.boolean().refine((val) => val === true, {
    message: 'Du måste bekräfta konsekvenserna.'
  })
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  const payload = deleteSchema.parse(await readBody(event))
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  // Get tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Distributören kunde inte hittas.' })
  }

  // Store tenant info for audit log before deletion
  const tenantInfo = {
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type
  }

  // Only allow deletion of distributors
  if (tenant.type !== 'distributor') {
    throw createError({
      statusCode: 400,
      message: 'Endast distributörer kan raderas via denna endpoint.'
    })
  }

  // Verify slug matches
  if (payload.confirmSlug !== tenant.slug) {
    throw createError({
      statusCode: 400,
      message: 'Sluggen matchar inte distributören.'
    })
  }

  // Check if distributor has any providers linked
  const linkedProviders = await db
    .select({ providerId: distributorProviders.providerId })
    .from(distributorProviders)
    .where(eq(distributorProviders.distributorId, tenantId))

  if (linkedProviders.length > 0) {
    // Check if any of these providers have organizations
    const providerIds = linkedProviders.map((link) => link.providerId)
    
    // Get all organizations for these providers
    const orgs = await db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        providerId: organizations.tenantId,
        providerName: tenants.name,
        providerSlug: tenants.slug
      })
      .from(organizations)
      .innerJoin(tenants, eq(tenants.id, organizations.tenantId))
      .where(inArray(organizations.tenantId, providerIds))

    if (orgs.length > 0) {
      // Group by provider to create a summary
      const orgsByProvider = new Map<string, { providerName: string; providerSlug: string; orgs: Array<{ name: string; slug: string }> }>()
      
      for (const org of orgs) {
        if (!org.providerId) continue
        if (!orgsByProvider.has(org.providerId)) {
          orgsByProvider.set(org.providerId, {
            providerName: org.providerName,
            providerSlug: org.providerSlug,
            orgs: []
          })
        }
        orgsByProvider.get(org.providerId)!.orgs.push({
          name: org.organizationName,
          slug: org.organizationSlug
        })
      }

      const providerList = Array.from(orgsByProvider.values())
        .map((p) => `• ${p.providerName} (${p.providerSlug}): ${p.orgs.length} organisationer`)
        .join('\n')
      
      const totalOrgs = orgs.length
      const orgWord = totalOrgs === 1 ? 'organisation' : 'organisationer'
      
      throw createError({
        statusCode: 400,
        message: `Distributören kan inte raderas eftersom den har ${totalOrgs} ${orgWord} kopplade via leverantörer.\n\nLeverantörer med organisationer:\n${providerList}\n\nTa bort alla kopplade organisationer först innan du kan radera distributören.`
      })
    }
  }

  // Delete distributor and all related data
  if (isSqlite) {
    db.transaction((tx) => {
      // Delete distributor-provider links
      tx.delete(distributorProviders)
        .where(eq(distributorProviders.distributorId, tenantId))
        .run()

      // Delete tenant memberships
      tx.delete(tenantMemberships).where(eq(tenantMemberships.tenantId, tenantId)).run()

      // Delete tenant
      tx.delete(tenants).where(eq(tenants.id, tenantId)).run()
    })
  } else {
    await db.transaction(async (tx) => {
      // Delete distributor-provider links
      await tx.delete(distributorProviders).where(eq(distributorProviders.distributorId, tenantId))

      // Delete tenant memberships
      await tx.delete(tenantMemberships).where(eq(tenantMemberships.tenantId, tenantId))

      // Delete tenant
      await tx.delete(tenants).where(eq(tenants.id, tenantId))
    })
  }

  // Log audit event
  await logTenantAction(event, 'TENANT_DELETED', {
    tenantName: tenantInfo.name,
    tenantSlug: tenantInfo.slug,
    tenantType: tenantInfo.type
  }, tenantId)

  return { success: true }
})

