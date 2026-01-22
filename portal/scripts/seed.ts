// @ts-nocheck
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'
import { getDb, resetDbInstance } from '../server/utils/db'
import {
  organizationAuthSettings,
  organizationMemberships,
  organizations,
  tenants,
  users
} from '../server/database/schema'
import { hashPassword } from '../server/utils/crypto'

const ownerEmail = 'owner@example.com'
const ownerPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const ownerName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

const seed = async () => {
  const db = getDb()
  const ownerPasswordHash = await hashPassword(ownerPassword)

  console.log('🌱 Startar seed av distributör, leverantör och organisationer...')

  await db.transaction((tx) => {
    // 1. Skapa eller hitta användaren owner@example.com
    let ownerUser = tx.select().from(users).where(eq(users.email, ownerEmail)).limit(1).all()

    if (ownerUser.length === 0) {
      const ownerUserId = createId()
      tx.insert(users)
        .values({
          id: ownerUserId,
          email: ownerEmail,
          passwordHash: ownerPasswordHash,
          fullName: ownerName,
          status: 'active',
          isSuperAdmin: 1,
          defaultOrgId: null
        })
        .run()
      ownerUser = [{ id: ownerUserId }]
      console.log(`✅ Skapade användare: ${ownerEmail}`)
    } else {
      console.log(`ℹ️  Användare ${ownerEmail} finns redan`)
    }

    const ownerUserId = ownerUser[0].id

    // 2. Skapa provider tenant
    const providerId = createId()
    tx.insert(tenants)
      .values({
        id: providerId,
        name: 'Provider',
        slug: 'provider',
        type: 'provider',
        parentTenantId: null,
        status: 'active'
      })
      .run()
    console.log('✅ Skapade provider tenant')

    // 3. Skapa distributor tenant (under provider)
    const distributorId = createId()
    tx.insert(tenants)
      .values({
        id: distributorId,
        name: 'Distributör',
        slug: 'distributor',
        type: 'distributor',
        parentTenantId: providerId,
        status: 'active'
      })
      .run()
    console.log('✅ Skapade distributor tenant')

    // 4. Skapa 4 organisationer (under distributor)
    const orgIds = []
    const orgData = [
      { name: 'Organisation 1', slug: 'org-1' },
      { name: 'Organisation 2', slug: 'org-2' },
      { name: 'Organisation 3', slug: 'org-3' },
      { name: 'Organisation 4', slug: 'org-4' }
    ]

    for (const org of orgData) {
      const orgId = createId()
      orgIds.push(orgId)

      tx.insert(organizations)
        .values({
          id: orgId,
          name: org.name,
          slug: org.slug,
          tenantId: distributorId,
          status: 'active',
          defaultRole: 'viewer',
          requireSso: 0,
          allowSelfSignup: 0
        })
        .run()

      // Skapa auth settings för organisationen
      tx.insert(organizationAuthSettings)
        .values({
          organizationId: orgId,
          idpType: 'none',
          ssoEnforced: 0,
          allowLocalLoginForOwners: 1
        })
        .run()

      // Gör owner@example.com till ägare på organisationen
      tx.insert(organizationMemberships)
        .values({
          id: createId(),
          organizationId: orgId,
          userId: ownerUserId,
          role: 'owner',
          status: 'active'
        })
        .run()

      console.log(`✅ Skapade organisation: ${org.name}`)
    }

    // Sätt första organisationen som default för användaren
    if (orgIds.length > 0) {
      tx.update(users)
        .set({ defaultOrgId: orgIds[0] })
        .where(eq(users.id, ownerUserId))
        .run()
    }
  })

  console.log('✅ Seed klar!')
  console.log(`📧 Inloggning: ${ownerEmail} / ${ownerPassword}`)
  console.log('📋 Skapade:')
  console.log('   - 1 Provider')
  console.log('   - 1 Distributör')
  console.log('   - 4 Organisationer')
  console.log(`   - ${ownerEmail} är ägare på alla organisationer`)
}

seed()
  .catch((error) => {
    console.error('❌ Misslyckades med seed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })
