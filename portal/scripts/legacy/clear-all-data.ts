import 'dotenv/config'
import { getDb } from '../server/utils/db'
import {
  organizationAuthSettings,
  organizationInvitations,
  organizationMemberships,
  organizations,
  tenantMemberships,
  tenants,
  users
} from '../server/database/schema'

async function clearAllData() {
  const db = getDb()

  console.log('Clearing all data...')
  console.log('WARNING: This will delete ALL data!')

  try {
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

      console.log('All data cleared!')
    })

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
