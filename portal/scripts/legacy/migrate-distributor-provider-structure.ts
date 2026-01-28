import 'dotenv/config'
import { createId } from '@paralleldrive/cuid2'
import { eq, and, isNull, isNotNull } from 'drizzle-orm'
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
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  console.log('Starting distributor-provider structure migration...')

  try {
    if (isSqlite) {
      await db.transaction((tx) => {
        // 1. Get all current tenants
        const allTenants = tx.select().from(tenants).all()
        
        // 2. Identify current Providers (type='provider', no parent or parentTenantId is null)
        const currentProviders = allTenants.filter(
          t => t.type === 'provider' && (!t.parentTenantId || t.parentTenantId === null)
        )
        
        // 3. Identify current Distributors (type='distributor' with parentTenantId)
        const currentDistributors = allTenants.filter(
          t => t.type === 'distributor' && t.parentTenantId
        )
        
        console.log(`Found ${currentProviders.length} providers and ${currentDistributors.length} distributors`)
        
        // 4. For each Provider, create a default Distributor if none exists
        //    and create junction table entries
        for (const provider of currentProviders) {
          // Find distributors that were children of this provider
          const childDistributors = currentDistributors.filter(
            d => d.parentTenantId === provider.id
          )
          
          if (childDistributors.length === 0) {
            // No distributors for this provider - create a default one
            const defaultDistributorId = createId()
            tx.insert(tenants)
              .values({
                id: defaultDistributorId,
                name: `Default Distributor for ${provider.name}`,
                slug: `default-distributor-${provider.slug}`,
                type: 'distributor',
                parentTenantId: null, // Distributors are now root level
                status: 'active'
              })
              .run()
            
            // Create junction table entry
            tx.insert(distributorProviders)
              .values({
                id: createId(),
                distributorId: defaultDistributorId,
                providerId: provider.id
              })
              .run()
            
            console.log(`Created default distributor ${defaultDistributorId} for provider ${provider.id}`)
          } else {
            // Migrate existing distributors
            for (const distributor of childDistributors) {
              // Update distributor to be root level (remove parentTenantId)
              tx.update(tenants)
                .set({ parentTenantId: null })
                .where(eq(tenants.id, distributor.id))
                .run()
              
              // Create junction table entry
              tx.insert(distributorProviders)
                .values({
                  id: createId(),
                  distributorId: distributor.id,
                  providerId: provider.id
                })
                .run()
              
              console.log(`Migrated distributor ${distributor.id} to be root and linked to provider ${provider.id}`)
            }
          }
        }
        
        // 5. Handle any standalone distributors (distributors without a provider parent)
        const standaloneDistributors = allTenants.filter(
          t => t.type === 'distributor' && 
               (!t.parentTenantId || t.parentTenantId === null) &&
               !currentDistributors.some(d => d.id === t.id)
        )
        
        for (const distributor of standaloneDistributors) {
          // These are already root level, but we need to check if they have providers
          // If not, we might need to create a default provider or leave them as-is
          console.log(`Standalone distributor ${distributor.id} found - no migration needed`)
        }
        
        // 6. Verify organizations are pointing to Providers (not Distributors)
        // Organizations should have tenantId pointing to a Provider
        const allOrgs = tx.select().from(organizations).all()
        for (const org of allOrgs) {
          if (org.tenantId) {
            const tenant = allTenants.find(t => t.id === org.tenantId)
            if (tenant && tenant.type === 'distributor') {
              // Organization is pointing to a distributor - this needs to be fixed
              // Find a provider that is linked to this distributor
              const providerLinks = tx
                .select()
                .from(distributorProviders)
                .where(eq(distributorProviders.distributorId, tenant.id))
                .all()
              
              if (providerLinks.length > 0) {
                // Update organization to point to the first provider
                tx.update(organizations)
                  .set({ tenantId: providerLinks[0].providerId })
                  .where(eq(organizations.id, org.id))
                  .run()
                
                console.log(`Updated organization ${org.id} to point to provider ${providerLinks[0].providerId} instead of distributor ${tenant.id}`)
              } else {
                console.warn(`Organization ${org.id} points to distributor ${tenant.id} but no provider link found`)
              }
            }
          }
        }
        
        console.log('Migration completed successfully!')
      })
    } else {
      // MySQL/MariaDB transaction
      await db.transaction(async (tx) => {
        // Same logic as above but using async/await
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
    }
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

