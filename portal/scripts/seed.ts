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

  console.log('Startar seed av distributor, leverantor och organisationer...')

  await db.transaction(async (tx) => {
    // 1. Skapa eller hitta anvandaren owner@example.com
    let ownerUser = await tx.select().from(users).where(eq(users.email, ownerEmail)).limit(1)

    if (ownerUser.length === 0) {
      const ownerUserId = createId()
      await tx.insert(users)
        .values({
          id: ownerUserId,
          email: ownerEmail,
          passwordHash: ownerPasswordHash,
          fullName: ownerName,
          status: 'active',
          isSuperAdmin: true,
          defaultOrgId: null
        })
      ownerUser = [{ id: ownerUserId }]
      console.log(`Skapade anvandare: ${ownerEmail}`)
    } else {
      console.log(`Anvandare ${ownerEmail} finns redan`)
    }

    const ownerUserId = ownerUser[0].id

    // 2. Skapa provider tenant
    const providerId = createId()
    await tx.insert(tenants)
      .values({
        id: providerId,
        name: 'Provider',
        slug: 'provider',
        type: 'provider',
        parentTenantId: null,
        status: 'active'
      })
    console.log('Skapade provider tenant')

    // 3. Skapa distributor tenant (under provider)
    const distributorId = createId()
    await tx.insert(tenants)
      .values({
        id: distributorId,
        name: 'Distributor',
        slug: 'distributor',
        type: 'distributor',
        parentTenantId: providerId,
        status: 'active'
      })
    console.log('Skapade distributor tenant')

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

      await tx.insert(organizations)
        .values({
          id: orgId,
          name: org.name,
          slug: org.slug,
          tenantId: distributorId,
          status: 'active',
          defaultRole: 'viewer',
          requireSso: false,
          allowSelfSignup: false
        })

      // Skapa auth settings for organisationen
      await tx.insert(organizationAuthSettings)
        .values({
          organizationId: orgId,
          idpType: 'none',
          ssoEnforced: false,
          allowLocalLoginForOwners: true
        })

      // Gor owner@example.com till agare pa organisationen
      await tx.insert(organizationMemberships)
        .values({
          id: createId(),
          organizationId: orgId,
          userId: ownerUserId,
          role: 'owner',
          status: 'active'
        })

      console.log(`Skapade organisation: ${org.name}`)
    }

    // Satt forsta organisationen som default for anvandaren
    if (orgIds.length > 0) {
      await tx.update(users)
        .set({ defaultOrgId: orgIds[0] })
        .where(eq(users.id, ownerUserId))
    }
  })

  console.log('Seed klar!')
  console.log(`Inloggning: ${ownerEmail} / ${ownerPassword}`)
  console.log('Skapade:')
  console.log('   - 1 Provider')
  console.log('   - 1 Distributor')
  console.log('   - 4 Organisationer')
  console.log(`   - ${ownerEmail} ar agare pa alla organisationer`)
}

seed()
  .catch((error) => {
    console.error('Misslyckades med seed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })
