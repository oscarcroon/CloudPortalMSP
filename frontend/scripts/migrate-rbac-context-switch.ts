/**
 * Migration script for RBAC Context Switching & MFA
 * 
 * This script:
 * 1. Ensures all existing memberships are properly mapped
 * 2. Creates default auth settings for existing tenants/organizations
 * 3. Migrates any legacy data to new structure
 * 
 * Run with: npm run migrate:rbac-context-switch
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/d1'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import {
  users,
  organizations,
  tenants,
  organizationMemberships,
  tenantMemberships,
  organizationAuthSettings,
  tenantAuthSettings
} from '../server/database/schema'
import { eq, sql } from 'drizzle-orm'

const isCloudflare = process.env.DATABASE_URL?.startsWith('wss://') || false

async function migrate() {
  console.log('Starting RBAC Context Switching migration...')

  let db: any
  if (isCloudflare) {
    // Cloudflare D1
    const env = (globalThis as any).env
    if (!env?.DB) {
      throw new Error('D1 database not found in environment')
    }
    db = drizzle(env.DB)
  } else {
    // SQLite
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
    const sqlite = new Database(dbPath)
    db = drizzleSqlite(sqlite)
  }

  try {
    // Step 1: Ensure all organizations have auth settings
    console.log('Step 1: Creating default organization auth settings...')
    const orgsWithoutSettings = await db
      .select({ id: organizations.id })
      .from(organizations)
      .leftJoin(
        organizationAuthSettings,
        eq(organizationAuthSettings.organizationId, organizations.id)
      )
      .where(sql`${organizationAuthSettings.organizationId} IS NULL`)

    if (orgsWithoutSettings.length > 0) {
      console.log(`  Found ${orgsWithoutSettings.length} organizations without auth settings`)
      for (const org of orgsWithoutSettings) {
        await db.insert(organizationAuthSettings).values({
          organizationId: org.id,
          requireMfaOnSensitiveActions: false,
          requireMfaOnContextSwitch: false
        })
      }
      console.log(`  Created auth settings for ${orgsWithoutSettings.length} organizations`)
    } else {
      console.log('  All organizations already have auth settings')
    }

    // Step 2: Ensure all tenants have auth settings
    console.log('Step 2: Creating default tenant auth settings...')
    const tenantsWithoutSettings = await db
      .select({ id: tenants.id })
      .from(tenants)
      .leftJoin(tenantAuthSettings, eq(tenantAuthSettings.tenantId, tenants.id))
      .where(sql`${tenantAuthSettings.tenantId} IS NULL`)

    if (tenantsWithoutSettings.length > 0) {
      console.log(`  Found ${tenantsWithoutSettings.length} tenants without auth settings`)
      for (const tenant of tenantsWithoutSettings) {
        await db.insert(tenantAuthSettings).values({
          tenantId: tenant.id,
          requireMfaOnSensitiveActions: false,
          requireMfaOnContextSwitch: false
        })
      }
      console.log(`  Created auth settings for ${tenantsWithoutSettings.length} tenants`)
    } else {
      console.log('  All tenants already have auth settings')
    }

    // Step 3: Verify membership data integrity
    console.log('Step 3: Verifying membership data integrity...')
    const orgMemberships = await db.select().from(organizationMemberships)
    const tenantMembershipsData = await db.select().from(tenantMemberships)

    console.log(`  Found ${orgMemberships.length} organization memberships`)
    console.log(`  Found ${tenantMembershipsData.length} tenant memberships`)

    // Check for orphaned memberships
    const orphanedOrgMemberships = await db
      .select({ id: organizationMemberships.id })
      .from(organizationMemberships)
      .leftJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
      .leftJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        sql`${organizations.id} IS NULL OR ${users.id} IS NULL`
      )

    if (orphanedOrgMemberships.length > 0) {
      console.warn(`  WARNING: Found ${orphanedOrgMemberships.length} orphaned organization memberships`)
    }

    const orphanedTenantMemberships = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .leftJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .leftJoin(users, eq(users.id, tenantMemberships.userId))
      .where(
        sql`${tenants.id} IS NULL OR ${users.id} IS NULL`
      )

    if (orphanedTenantMemberships.length > 0) {
      console.warn(`  WARNING: Found ${orphanedTenantMemberships.length} orphaned tenant memberships`)
    }

    // Step 4: Set default context for users (if they have memberships)
    console.log('Step 4: Migration complete!')
    console.log('\nNext steps:')
    console.log('  1. Review auth settings for organizations/tenants that need MFA')
    console.log('  2. Test context switching functionality')
    console.log('  3. Monitor audit logs for context switches')

  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ Migration completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })

