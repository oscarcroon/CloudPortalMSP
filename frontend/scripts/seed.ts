// @ts-nocheck
import { createId } from '@paralleldrive/cuid2'
import { getDb, resetDbInstance } from '../src/server/utils/db'
import {
  organizationMemberships,
  organizations,
  users
} from '../src/server/database/schema'
import { hashPassword } from '../src/server/utils/crypto'

const ownerOrgId = createId()
const internalOrgId = createId()
const ownerUserId = createId()
const viewerUserId = createId()

const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'owner@example.com'
const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const superAdminName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

const seed = async () => {
  const db = getDb()
  const ownerPasswordHash = await hashPassword(superAdminPassword)
  const viewerPasswordHash = await hashPassword('ViewerPass123!')

  await db.transaction((tx) => {
    tx.delete(organizationMemberships).run()
    tx.delete(users).run()
    tx.delete(organizations).run()

    tx.insert(organizations).values([
      {
        id: ownerOrgId,
        name: 'CoreIT Shared Services',
        slug: 'coreit-shared',
        status: 'active',
        defaultRole: 'owner',
        enforceSso: 0,
        selfSignupEnabled: 0
      },
      {
        id: internalOrgId,
        name: 'Internal IT',
        slug: 'internal-it',
        status: 'active',
        defaultRole: 'viewer',
        enforceSso: 0,
        selfSignupEnabled: 0
      }
    ]).run()

    tx.insert(users).values([
      {
        id: ownerUserId,
        email: superAdminEmail,
        passwordHash: ownerPasswordHash,
        fullName: superAdminName,
        status: 'active',
        defaultOrgId: ownerOrgId,
        isSuperAdmin: 1
      },
      {
        id: viewerUserId,
        email: 'viewer@example.com',
        passwordHash: viewerPasswordHash,
        fullName: 'Site Viewer',
        status: 'active',
        defaultOrgId: internalOrgId
      }
    ]).run()

    tx.insert(organizationMemberships).values([
      {
        id: createId(),
        organizationId: ownerOrgId,
        userId: ownerUserId,
        role: 'owner'
      },
      {
        id: createId(),
        organizationId: internalOrgId,
        userId: ownerUserId,
        role: 'admin'
      },
      {
        id: createId(),
        organizationId: internalOrgId,
        userId: viewerUserId,
        role: 'viewer'
      }
    ]).run()
  })

  console.log('Seeded organizations and users with default memberships.')
  console.log(`Superadmin credentials -> ${superAdminEmail} / ${superAdminPassword}`)
}

seed()
  .catch((error) => {
    console.error('Failed to seed database:', error)
    process.exitCode = 1
  })
  .finally(() => {
    resetDbInstance()
  })

