import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { requireTenantPermission } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { organizations, tenants } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')

  if (!tenantId) {
    throw createError({ statusCode: 400, message: 'Tenant ID saknas' })
  }

  await requireTenantPermission(event, 'tenants:read', tenantId)

  const db = getDb()

  // Verify tenant exists
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) {
    throw createError({ statusCode: 404, message: 'Tenant kunde inte hittas.' })
  }

  // Get all active organizations for this tenant
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status
    })
    .from(organizations)
    .where(eq(organizations.tenantId, tenantId))
    .orderBy(organizations.name)

  // Filter to only active organizations
  const activeOrgs = orgs.filter((org) => org.status === 'active')

  return {
    organizations: activeOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug
    }))
  }
})
