import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { DrizzleDb } from '~~/server/utils/db'
import { organizationMemberships, users } from '~~/server/database/schema'

export const fetchMemberPayload = async (db: DrizzleDb, membershipId: string) => {
  const [member] = await db
    .select({
      membershipId: organizationMemberships.id,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      role: organizationMemberships.role,
      status: organizationMemberships.status,
      addedAt: organizationMemberships.createdAt
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.id, membershipId))

  if (!member) {
    throw createError({ statusCode: 404, message: 'Medlemmen kunde inte hittas.' })
  }

  return {
    member: {
      membershipId: member.membershipId,
      userId: member.userId,
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      status: member.status,
      addedAt: member.addedAt
    }
  }
}


