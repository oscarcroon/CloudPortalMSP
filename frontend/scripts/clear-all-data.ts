import 'dotenv/config'
import { getDb } from '../src/server/utils/db'
import {
  organizationAuthSettings,
  organizationInvitations,
  organizationMemberships,
  organizations,
  tenantMemberships,
  tenants,
  users
} from '../src/server/database/schema'

async function clearAllData() {
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  console.log('Clearing all data...')
  console.log('⚠️  WARNING: This will delete ALL data!')

  try {
    if (isSqlite) {
      await db.transaction((tx) => {
        // Delete in correct order (respecting foreign keys)
        console.log('Deleting organization auth settings...')
        tx.delete(organizationAuthSettings).run()

        console.log('Deleting organization invitations...')
        tx.delete(organizationInvitations).run()

        console.log('Deleting organization memberships...')
        tx.delete(organizationMemberships).run()

        console.log('Deleting organizations...')
        tx.delete(organizations).run()

        console.log('Deleting tenant memberships...')
        tx.delete(tenantMemberships).run()

        console.log('Deleting tenants...')
        tx.delete(tenants).run()

        // Delete all users (they will be recreated by seed)
        console.log('Deleting users...')
        tx.delete(users).run()

        console.log('✅ All data cleared!')
      })
    } else {
      await db.transaction(async (tx) => {
        // Delete in correct order (respecting foreign keys)
        console.log('Deleting organization auth settings...')
        await tx.delete(organizationAuthSettings)

        console.log('Deleting organization invitations...')
        await tx.delete(organizationInvitations)

        console.log('Deleting organization memberships...')
        await tx.delete(organizationMemberships)

        console.log('Deleting organizations...')
        await tx.delete(organizations)

        console.log('Deleting tenant memberships...')
        await tx.delete(tenantMemberships)

        console.log('Deleting tenants...')
        await tx.delete(tenants)

        // Delete all users (they will be recreated by seed)
        console.log('Deleting users...')
        await tx.delete(users)

        console.log('✅ All data cleared!')
      })
    }

    console.log('Done!')
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

clearAllData()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

