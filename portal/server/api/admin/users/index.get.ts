import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { getQuery, defineEventHandler } from 'h3'
import { users, organizationMemberships } from '~~/server/database/schema'
import { getDb } from '~~/server/utils/db'
import { requireSuperAdmin } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const query = getQuery(event)
  const search = typeof query.q === 'string' ? query.q.trim() : ''
  const db = getDb()

  const filters: any[] = []
  if (search.length > 0) {
    const pattern = `%${search}%`
    filters.push(or(like(users.email, pattern), like(users.fullName, pattern)))
  }
  const whereClause = filters.length ? and(...filters) : undefined

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status,
      isSuperAdmin: users.isSuperAdmin,
      forcePasswordReset: users.forcePasswordReset,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      organizationCount: sql<number>`count(${organizationMemberships.id})`,
      activeOrganizations: sql<number>`sum(case when ${organizationMemberships.status} = 'active' then 1 else 0 end)`
    })
    .from(users)
    .leftJoin(organizationMemberships, eq(organizationMemberships.userId, users.id))
    .where(whereClause)
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))

  return {
    users: rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      status: row.status,
      isSuperAdmin: Boolean(row.isSuperAdmin),
      forcePasswordReset: Boolean(row.forcePasswordReset),
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      organizationCount: Number(row.organizationCount ?? 0),
      activeOrganizations: Number(row.activeOrganizations ?? 0)
    }))
  }
})


