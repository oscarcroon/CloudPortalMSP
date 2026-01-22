import { createError, defineEventHandler, readBody } from 'h3'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../../../../utils/db'
import { requireSuperAdmin } from '../../../../utils/rbac'
import { logAuditEvent } from '../../../../utils/audit'
import {
  organizations,
  tenants,
  distributorProviders
} from '../../../../database/schema'
import {
  parseOrgParam,
  requireOrganizationByIdentifier,
  buildOrganizationDetailPayload
} from '../utils'

const moveProviderSchema = z.object({
  newTenantId: z.union([z.string().min(1), z.literal(null)])
})

export default defineEventHandler(async (event) => {
  // Auth & behörighet
  await requireSuperAdmin(event)
  
  // Parsa och validera payload
  const orgParam = parseOrgParam(event)
  const payload = moveProviderSchema.parse(await readBody(event))
  const { newTenantId } = payload
  
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'
  
  // Hämta organisation
  const organization = await requireOrganizationByIdentifier(db, orgParam)
  
  // No-op check
  if (newTenantId === organization.tenantId) {
    return {
      organization: await buildOrganizationDetailPayload(db, organization.id),
      message: 'No change - organization already has this provider'
    }
  }
  
  // Om newTenantId inte är null → validera provider
  if (newTenantId !== null) {
    const [provider] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, newTenantId))
      .limit(1)
    
    if (!provider) {
      throw createError({ statusCode: 404, message: 'Provider not found' })
    }
    
    if (provider.type !== 'provider') {
      throw createError({
        statusCode: 400,
        message: 'Tenant is not a provider'
      })
    }
    
    // Validera mot distributör (om organisationen redan har en provider)
    if (organization.tenantId) {
      // Hämta nuvarande providerns distributörer
      const currentProviderDistributors = await db
        .select({ distributorId: distributorProviders.distributorId })
        .from(distributorProviders)
        .where(eq(distributorProviders.providerId, organization.tenantId))
      
      // Om nuvarande providern har distributörer, kontrollera att nya providern också är kopplad till minst en av dem
      if (currentProviderDistributors.length > 0) {
        const distributorIds = currentProviderDistributors.map(d => d.distributorId)
        
        // Kontrollera att nya providern är kopplad till minst en av samma distributörer
        const newProviderDistributors = await db
          .select({ distributorId: distributorProviders.distributorId })
          .from(distributorProviders)
          .where(eq(distributorProviders.providerId, newTenantId))
        
        const newProviderDistributorIds = newProviderDistributors.map(d => d.distributorId)
        const hasCommonDistributor = distributorIds.some(id => newProviderDistributorIds.includes(id))
        
        if (!hasCommonDistributor) {
          throw createError({
            statusCode: 409,
            message: 'Provider is not available for this organization\'s distributor. The new provider must be linked to at least one of the same distributors as the current provider.'
          })
        }
      }
    }
  }
  
  // Transaktion – uppdatera org
  const oldTenantId = organization.tenantId
  
  try {
    if (isSqlite) {
      await db.transaction((tx) => {
        tx.update(organizations)
          .set({ tenantId: newTenantId })
          .where(eq(organizations.id, organization.id))
          .run()
        
        // TODO: framtida side-effects:
        // - migrera moduler / licenser
        // - uppdatera billing-koppling
        // - invalidera sessions/token om claims bygger på provider/tenant
        // - etc.
      })
    } else {
      await db.transaction(async (tx) => {
        await tx
          .update(organizations)
          .set({ tenantId: newTenantId })
          .where(eq(organizations.id, organization.id))
        
        // TODO: framtida side-effects:
        // - migrera moduler / licenser
        // - uppdatera billing-koppling
        // - invalidera sessions/token om claims bygger på provider/tenant
        // - etc.
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Failed to update organization provider'
    })
  }
  
  // Audit-logg
  await logAuditEvent(
    event,
    'ORG_SETTINGS_UPDATED',
    {
      action: 'move_provider',
      organizationId: organization.id,
      oldTenantId: oldTenantId ?? null,
      newTenantId: newTenantId ?? null
    }
  )
  
  // Returnera uppdaterad organisation
  const updatedDetail = await buildOrganizationDetailPayload(db, organization.id)
  return updatedDetail
})

