import { and, eq, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getDb, resetDbInstance } from '../server/utils/db'
import {
  organizationMemberships,
  organizations,
  users
} from '../server/database/schema'

const backfillOwners = async () => {
  const db = getDb()
  const [superAdmin] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(eq(users.isSuperAdmin, 1))
    .limit(1)

  if (!superAdmin) {
    throw new Error('Hittade ingen superadmin-användare att återanvända som ägare.')
  }

  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
  let updatedCount = 0

  for (const org of orgs) {
    const [ownerStats] = await db
      .select({
        count: sql<number>`count(${organizationMemberships.id})`
      })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, org.id),
          eq(organizationMemberships.role, 'owner'),
          eq(organizationMemberships.status, 'active')
        )
      )

    if ((ownerStats?.count ?? 0) > 0) {
      continue
    }

    await db.insert(organizationMemberships).values({
      id: createId(),
      organizationId: org.id,
      userId: superAdmin.id,
      role: 'owner',
      status: 'active'
    })
    updatedCount += 1
    console.log(`Tilldelade ${org.name} en temporär ägare (${superAdmin.id}).`)
  }

  if (updatedCount === 0) {
    console.log('Alla organisationer hade redan minst en ägare.')
  } else {
    console.log(`Kopplade superadmin som ägare på ${updatedCount} organisationer utan owner.`)
  }
}

backfillOwners()
  .catch((error) => {
    console.error('Backfill av owners misslyckades:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })

