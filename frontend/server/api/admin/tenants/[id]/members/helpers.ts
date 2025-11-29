import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { DrizzleDb } from '~~/server/utils/db'
import { tenantMemberships, users } from '~~/server/database/schema'

export const fetchTenantMemberPayload = async (db: DrizzleDb, membershipId: string) => {
  const [member] = await db
    .select({
      id: tenantMemberships.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: tenantMemberships.role,
      status: tenantMemberships.status,
      includeChildren: tenantMemberships.includeChildren,
      createdAt: tenantMemberships.createdAt
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(eq(tenantMemberships.id, membershipId))
    .limit(1)

  if (!member) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  return {
    member: {
      id: member.id,
      userId: member.userId,
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      status: member.status,
      includeChildren: member.includeChildren,
      createdAt: member.createdAt
    }
  }
}

