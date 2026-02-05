import 'dotenv/config'
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { getDb } from '../server/utils/db'
import {
  tenants,
  distributorProviders,
  organizations
} from '../server/database/schema'

/**
 * Migrates from old structure (Provider -> Distributor -> Organization)
 * to new structure (Distributor -> Provider -> Organization)
 *
 * Old: Provider (root) -> Distributor (child) -> Organization (tenantId = distributor)
 * New: Distributor (root) -> Provider (via junction) -> Organization (tenantId = provider)
 */
async function migrateDistributorProviderStructure() {
  const db = getDb()

  console.log('Starting distributor-provider structure migration...')

  try {
    await db.transaction(async (tx) => {
      const allTenants = await tx.select().from(tenants)

      const currentProviders = allTenants.filter(
        t => t.type === 'provider' && (!t.parentTenantId || t.parentTenantId === null)
      )

      const currentDistributors = allTenants.filter(
        t => t.type === 'distributor' && t.parentTenantId
      )

      console.log(`Found ${currentProviders.length} providers and ${currentDistributors.length} distributors`)

      for (const provider of currentProviders) {
        const childDistributors = currentDistributors.filter(
          d => d.parentTenantId === provider.id
        )

        if (childDistributors.length === 0) {
          const defaultDistributorId = createId()
          await tx.insert(tenants).values({
            id: defaultDistributorId,
            name: `Default Distributor for ${provider.name}`,
            slug: `default-distributor-${provider.slug}`,
            type: 'distributor',
            parentTenantId: null,
            status: 'active'
          })

          await tx.insert(distributorProviders).values({
            id: createId(),
            distributorId: defaultDistributorId,
            providerId: provider.id
          })

          console.log(`Created default distributor ${defaultDistributorId} for provider ${provider.id}`)
        } else {
          for (const distributor of childDistributors) {
            await tx.update(tenants)
              .set({ parentTenantId: null })
              .where(eq(tenants.id, distributor.id))

            await tx.insert(distributorProviders).values({
              id: createId(),
              distributorId: distributor.id,
              providerId: provider.id
            })

            console.log(`Migrated distributor ${distributor.id} to be root and linked to provider ${provider.id}`)
          }
        }
      }

      const allOrgs = await tx.select().from(organizations)
      for (const org of allOrgs) {
        if (org.tenantId) {
          const tenant = allTenants.find(t => t.id === org.tenantId)
          if (tenant && tenant.type === 'distributor') {
            const providerLinks = await tx
              .select()
              .from(distributorProviders)
              .where(eq(distributorProviders.distributorId, tenant.id))

            if (providerLinks.length > 0) {
              await tx.update(organizations)
                .set({ tenantId: providerLinks[0].providerId })
                .where(eq(organizations.id, org.id))

              console.log(`Updated organization ${org.id} to point to provider ${providerLinks[0].providerId}`)
            }
          }
        }
      }

      console.log('Migration completed successfully!')
    })
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

migrateDistributorProviderStructure()
  .then(() => {
    console.log('Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration script failed:', error)
    process.exit(1)
  })
