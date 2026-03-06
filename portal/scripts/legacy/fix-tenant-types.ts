import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { getDb } from '../server/utils/db'
import { tenants } from '../server/database/schema'

async function fixTenantTypes() {
  const db = getDb()

  console.log('Fixing tenant types...')

  try {
    const oldTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.type, 'supplier' as any))

    console.log(`Found ${oldTenants.length} tenants with old type 'supplier'`)

    if (oldTenants.length > 0) {
      await db
        .update(tenants)
        .set({ type: 'provider' as any })
        .where(eq(tenants.type, 'supplier' as any))

      console.log(`Updated ${oldTenants.length} tenants from 'supplier' to 'provider'`)
    }

    const oldCustomers = await db
      .select()
      .from(tenants)
      .where(eq(tenants.type, 'customer' as any))

    console.log(`Found ${oldCustomers.length} tenants with old type 'customer'`)

    if (oldCustomers.length > 0) {
      await db
        .update(tenants)
        .set({ type: 'organization' as any })
        .where(eq(tenants.type, 'customer' as any))

      console.log(`Updated ${oldCustomers.length} tenants from 'customer' to 'organization'`)
    }

    console.log('Done!')
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

fixTenantTypes()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
