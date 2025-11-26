import { and, eq, ne } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { tenants } from '../../../../database/schema'
import { getDb } from '../../../../utils/db'
import { requireTenantPermission } from '../../../../utils/rbac'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const updateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(slugRegex, 'Slug måste vara lowercase och får endast innehålla bindestreck.')
    .optional(),
  status: z.enum(['active', 'inactive']).optional()
})

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')
  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Missing tenant ID' })
  }

  await requireTenantPermission(event, 'tenants:manage', tenantId)

  const payload = updateTenantSchema.parse(await readBody(event))
  const db = getDb()

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant not found' })
  }

  const updates: Partial<typeof tenants.$inferInsert> = {}
  if (payload.name) {
    updates.name = payload.name
  }
  if (payload.slug) {
    // Check if slug is already taken by another tenant
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.slug, payload.slug), ne(tenants.id, tenantId)))
    
    if (existingTenant) {
      throw createError({
        statusCode: 400,
        message: 'En tenant med denna slug finns redan.'
      })
    }
    updates.slug = payload.slug
  }
  if (payload.status) {
    updates.status = payload.status
  }

  if (Object.keys(updates).length === 0) {
    return { tenant }
  }

  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  if (isSqlite) {
    await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .run()
  } else {
    await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
  }

  const [updatedTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId))

  return { tenant: updatedTenant }
})

