import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import {
  brandingThemes,
  distributorProviders,
  emailProviderProfiles,
  organizations,
  tenantAuthSettings,
  tenantInvitations,
  tenantMemberships,
  tenantModulePolicies,
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
    throw createError({ statusCode: 404, message: 'Den angivna tenanten kunde inte hittas.' })
  }

  const deletableTypes = ['distributor', 'provider'] as const
  type DeletableType = (typeof deletableTypes)[number]
  const typeLabels: Record<DeletableType, { nounDef: string; nounCap: string }> = {
    distributor: {
      nounDef: 'distributören',
      nounCap: 'Distributören'
    },
    provider: {
      nounDef: 'leverantören',
      nounCap: 'Leverantören'
    }
  }

  if (!deletableTypes.includes(tenant.type as DeletableType)) {
    throw createError({
      statusCode: 400,
      message: 'Endast distributörer och leverantörer kan raderas via denna endpoint.'
    })
  }

  const tenantType = tenant.type as DeletableType
  const typeCopy = typeLabels[tenantType]

  // Store tenant info for audit log before deletion
  const tenantInfo = {
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type
  }

  // Verify slug matches
  if (payload.confirmSlug !== tenant.slug) {
    throw createError({
      statusCode: 400,
      message: `Sluggen matchar inte ${typeCopy.nounDef}.`
    })
  }

  if (tenantType === 'provider') {
    const providerOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug
      })
      .from(organizations)
      .where(eq(organizations.tenantId, tenantId))

    const legacyChildTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug
      })
      .from(tenants)
      .where(and(eq(tenants.parentTenantId, tenantId), eq(tenants.type, 'organization')))

    const orgMap = new Map<string, { name: string; slug: string }>()
    for (const org of providerOrgs) {
      orgMap.set(org.slug, { name: org.name, slug: org.slug })
    }
    for (const child of legacyChildTenants) {
      if (!orgMap.has(child.slug)) {
        orgMap.set(child.slug, { name: child.name, slug: child.slug })
      }
    }

    const orgSummary = Array.from(orgMap.values())
    if (orgSummary.length > 0) {
      const orgWord = orgSummary.length === 1 ? 'organisation' : 'organisationer'
      const displayLimit = 10
      const orgList = orgSummary
        .slice(0, displayLimit)
        .map((org) => `• ${org.name} (${org.slug})`)
        .join('\n')
      const extraCount = orgSummary.length > displayLimit ? orgSummary.length - displayLimit : 0
      const extraLine = extraCount > 0 ? `\n... och ${extraCount} till` : ''

      throw createError({
        statusCode: 400,
        message: `Leverantören kan inte raderas eftersom den har ${orgSummary.length} ${orgWord} kopplade.\n\nOrganisationer:\n${orgList}${extraLine}\n\nTa bort alla kopplade organisationer först innan du kan radera leverantören.`
      })
    }
  }

  if (tenantType === 'distributor') {
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
  }

  // Delete distributor and all related data
  const distributorProviderCondition = or(
    eq(distributorProviders.distributorId, tenantId),
    eq(distributorProviders.providerId, tenantId)
  )
  if (isSqlite) {
    db.transaction((tx) => {
      tx.delete(tenantModulePolicies).where(eq(tenantModulePolicies.tenantId, tenantId)).run()
      tx.delete(emailProviderProfiles).where(eq(emailProviderProfiles.tenantId, tenantId)).run()
      tx.delete(tenantAuthSettings).where(eq(tenantAuthSettings.tenantId, tenantId)).run()
      tx.delete(tenantInvitations).where(eq(tenantInvitations.tenantId, tenantId)).run()
      tx.delete(brandingThemes).where(eq(brandingThemes.tenantId, tenantId)).run()
      tx.delete(distributorProviders).where(distributorProviderCondition).run()
      tx.delete(tenantMemberships).where(eq(tenantMemberships.tenantId, tenantId)).run()
      tx.delete(tenants).where(eq(tenants.id, tenantId)).run()
    })
  } else {
    await db.transaction(async (tx) => {
      await tx.delete(tenantModulePolicies).where(eq(tenantModulePolicies.tenantId, tenantId))
      await tx.delete(emailProviderProfiles).where(eq(emailProviderProfiles.tenantId, tenantId))
      await tx.delete(tenantAuthSettings).where(eq(tenantAuthSettings.tenantId, tenantId))
      await tx.delete(tenantInvitations).where(eq(tenantInvitations.tenantId, tenantId))
      await tx.delete(brandingThemes).where(eq(brandingThemes.tenantId, tenantId))
      await tx.delete(distributorProviders).where(distributorProviderCondition)
      await tx.delete(tenantMemberships).where(eq(tenantMemberships.tenantId, tenantId))
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

