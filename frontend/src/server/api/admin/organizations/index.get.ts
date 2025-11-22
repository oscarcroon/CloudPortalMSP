import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations
} from '../../../database/schema'
import { getDb } from '../../../utils/db'
import { requireSuperAdmin } from '../../../utils/rbac'

const querySchema = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const { q, limit = 50 } = querySchema.parse(getQuery(event))
  const db = getDb()

  let query = db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      status: organizations.status,
      requireSso: organizations.requireSso,
      allowSelfSignup: organizations.allowSelfSignup,
      defaultRole: organizations.defaultRole,
      billingEmail: organizations.billingEmail,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`count(${organizationMemberships.id})`,
      ssoEnforced: organizationAuthSettings.ssoEnforced
    })
    .from(organizations)
    .leftJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.status, 'active')
      )
    )
    .leftJoin(
      organizationAuthSettings,
      eq(organizationAuthSettings.organizationId, organizations.id)
    )
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.slug,
      organizations.status,
      organizations.requireSso,
      organizations.allowSelfSignup,
      organizations.defaultRole,
      organizations.billingEmail,
      organizations.createdAt,
      organizationAuthSettings.ssoEnforced
    )
    .orderBy(desc(organizations.createdAt))
    .limit(limit)

  if (q && q.trim()) {
    const pattern = `%${q.trim()}%`
    query = query.where(
      or(like(organizations.name, pattern), like(organizations.slug, pattern))
    )
  }

  const rows = await query

  return {
    organizations: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      requireSso: Boolean(row.requireSso),
      allowSelfSignup: Boolean(row.allowSelfSignup),
      defaultRole: row.defaultRole,
      billingEmail: row.billingEmail,
      createdAt: row.createdAt,
      memberCount: row.memberCount,
      ssoEnforced: Boolean(row.ssoEnforced)
    }))
  }
})

