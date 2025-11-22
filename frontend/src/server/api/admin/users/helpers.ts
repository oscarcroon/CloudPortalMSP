import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { users } from '~/server/database/schema'
import { getDb } from '~/server/utils/db'

export const fetchUserRecord = async (userId: string) => {
  const db = getDb()
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      status: users.status,
      isSuperAdmin: users.isSuperAdmin,
      forcePasswordReset: users.forcePasswordReset,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user) {
    throw createError({ statusCode: 404, message: 'Användaren kunde inte hittas.' })
  }

  return user
}

export const assertAnotherSuperAdminWillRemain = async (userId: string) => {
  const db = getDb()
  const user = await fetchUserRecord(userId)

  if (!user.isSuperAdmin) {
    return user
  }

  const [countRow] = await db
    .select({
      value: sql<number>`count(*)`
    })
    .from(users)
    .where(eq(users.isSuperAdmin, 1))

  if ((countRow?.value ?? 0) <= 1) {
    throw createError({
      statusCode: 400,
      message: 'Det måste finnas minst en aktiv superadmin.'
    })
  }

  return user
}

