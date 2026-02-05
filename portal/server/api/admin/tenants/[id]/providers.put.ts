import { createId } from '@paralleldrive/cuid2'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { tenants, distributorProviders } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireTenantPermission } from '../../../../utils/rbac'

const updateProviderLinksSchema = z.object({
  distributorIds: z.array(z.string()).min(1, 'At least one distributor must be selected')
})

export default defineEventHandler(async (event) => {
  const providerId = getRouterParam(event, 'id')
  if (!providerId) {
    throw createError({ statusCode: 400, message: 'Missing provider ID' })
  }

  const payload = updateProviderLinksSchema.parse(await readBody(event))
  const db = getDb()

  // Validate provider
  const [provider] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, providerId))

  if (!provider) {
    throw createError({ statusCode: 404, message: 'Provider not found' })
  }

  if (provider.type !== 'provider') {
    throw createError({
      statusCode: 400,
      message: 'Tenant is not a provider'
    })
  }

  // Check permission
  await requireTenantPermission(event, 'tenants:manage', providerId)

  // Validate all distributors exist and user has permission
  for (const distributorId of payload.distributorIds) {
    const [distributor] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, distributorId))

    if (!distributor) {
      throw createError({ statusCode: 404, message: `Distributor ${distributorId} not found` })
    }

    if (distributor.type !== 'distributor') {
      throw createError({
        statusCode: 400,
        message: `Tenant ${distributorId} is not a distributor`
      })
    }

    // Check permission to link provider to this distributor
    await requireTenantPermission(event, 'tenants:manage', distributorId)
  }

  try {
    await db.transaction(async (tx) => {
      // Remove all existing links for this provider
      await tx.delete(distributorProviders)
        .where(eq(distributorProviders.providerId, providerId))

      // Create new links
      for (const distributorId of payload.distributorIds) {
        await tx.insert(distributorProviders).values({
          id: createId(),
          distributorId,
          providerId
        })
      }
    })
  } catch (error: any) {
    if (
      typeof error?.message === 'string' &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      throw createError({ statusCode: 409, message: 'Link already exists' })
    }
    throw error
  }

  // Return updated links
  const links = await db
    .select({
      distributorId: distributorProviders.distributorId,
      providerId: distributorProviders.providerId
    })
    .from(distributorProviders)
    .where(eq(distributorProviders.providerId, providerId))

  return {
    distributorIds: links.map(link => link.distributorId)
  }
})

