import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { getDb } from '../server/utils/db'
import { tenants } from '../server/database/schema'

async function fixTenantTypes() {
  const db = getDb()
  const isSqlite =
    (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase() === 'sqlite'

  console.log('Fixing tenant types...')

  try {
    if (isSqlite) {
      const oldTenants = db
        .select()
        .from(tenants)
        .where(eq(tenants.type, 'supplier' as any))
        .all()

      console.log(`Found ${oldTenants.length} tenants with old type 'supplier'`)

      if (oldTenants.length > 0) {
        db.update(tenants)
          .set({ type: 'provider' as any })
          .where(eq(tenants.type, 'supplier' as any))
          .run()

        console.log(`Updated ${oldTenants.length} tenants from 'supplier' to 'provider'`)
      }

      const oldCustomers = db
        .select()
        .from(tenants)
        .where(eq(tenants.type, 'customer' as any))
        .all()

      console.log(`Found ${oldCustomers.length} tenants with old type 'customer'`)

      if (oldCustomers.length > 0) {
        db.update(tenants)
          .set({ type: 'organization' as any })
          .where(eq(tenants.type, 'customer' as any))
          .run()

        console.log(`Updated ${oldCustomers.length} tenants from 'customer' to 'organization'`)
      }
    } else {
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

