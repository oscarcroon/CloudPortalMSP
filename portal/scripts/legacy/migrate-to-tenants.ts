import 'dotenv/config'
import { createId } from '@paralleldrive/cuid2'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../server/utils/db'
import {
  tenants,
  tenantMemberships,
  organizations,
  users
} from '../server/database/schema'

async function migrateToTenants() {
  const db = getDb()

  console.log('Starting tenant migration...')

  try {
    await db.transaction(async (tx) => {
      // 1. Create default provider
      const providerId = createId()
      await tx.insert(tenants).values({
        id: providerId,
        name: 'Default Provider',
        slug: 'default-provider',
        type: 'provider',
        parentTenantId: null,
        status: 'active'
      })

      // 2. Create default distributor under provider
      const distributorId = createId()
      await tx.insert(tenants).values({
        id: distributorId,
        name: 'Default Distributor',
        slug: 'default-distributor',
        type: 'distributor',
        parentTenantId: providerId,
        status: 'active'
      })

      // 3. Get all existing organizations
      const existingOrgs = await tx.select().from(organizations)

      // 4. Update all organizations to have tenantId pointing to distributor
      for (const org of existingOrgs) {
        await tx
          .update(organizations)
          .set({ tenantId: distributorId })
          .where(eq(organizations.id, org.id))
      }

      // 5. Get all super admins
      const superAdmins = await tx
        .select()
        .from(users)
        .where(eq(users.isSuperAdmin, true))

      // 6. Create tenant memberships for super admins as admin with includeChildren
      for (const admin of superAdmins) {
        // Check if membership already exists
        const existing = await tx
          .select()
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, providerId),
              eq(tenantMemberships.userId, admin.id)
            )
          )

        if (!existing.length) {
          await tx.insert(tenantMemberships).values({
            id: createId(),
            tenantId: providerId,
            userId: admin.id,
            role: 'admin',
            includeChildren: true,
            status: 'active'
          })
        }
      }

      console.log(`Created provider: ${providerId}`)
      console.log(`Created distributor: ${distributorId}`)
      console.log(`Updated ${existingOrgs.length} organizations`)
      console.log(`Created ${superAdmins.length} admin memberships with includeChildren`)
    })

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

migrateToTenants()
  .then(() => {
    console.log('Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
