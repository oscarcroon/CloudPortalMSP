import { defineEventHandler } from 'h3'
import { sql, desc, eq } from 'drizzle-orm'
import { getDb } from '../../../utils/db'
import { organizations, organizationMemberships } from '../../../database/schema'
import { requireSuperAdmin } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = getDb()

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      enforceSso: organizations.enforceSso,
      selfSignupEnabled: organizations.selfSignupEnabled,
      defaultRole: organizations.defaultRole,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`count(${organizationMemberships.id})`
    })
    .from(organizations)
    .leftJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.slug,
      organizations.status,
      organizations.enforceSso,
      organizations.selfSignupEnabled,
      organizations.defaultRole,
      organizations.createdAt
    )
    .orderBy(desc(organizations.createdAt))

  return {
    organizations: rows
  }
})

