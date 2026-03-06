/**
 * Cloudflare DNS Plugin Schema
 *
 * This schema is owned by the cloudflare-dns layer and imported into the core schema.
 * All tables are prefixed with 'cloudflare_dns_' to avoid conflicts.
 */

import { createId } from '@paralleldrive/cuid2'
import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core'

const timestampColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow()
})

/**
 * Factory function to create the Cloudflare DNS schema with proper foreign key references.
 * This allows the layer to define its schema while still referencing the core organizations table.
 */
export function createCloudflareDnsSchema(organizationsIdColumn: AnyMySqlColumn) {
  /**
   * Cloudflare DNS organization configuration
   * Stores encrypted API tokens and sync status per organization.
   */
  const cloudflareDnsOrgConfig = mysqlTable(
    'cloudflare_dns_org_config',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      encryptedApiToken: text('encrypted_api_token').notNull(),
      encryptionIv: text('encryption_iv').notNull(),
      encryptionAuthTag: text('encryption_auth_tag').notNull(),
      accountId: varchar('account_id', { length: 255 }),
      lastSyncAt: timestamp('last_sync_at', { fsp: 3 }),
      lastSyncStatus: varchar('last_sync_status', { length: 50 }),
      lastSyncError: text('last_sync_error'),
      lastValidatedAt: timestamp('last_validated_at', { fsp: 3 }),
      ...timestampColumns()
    },
    (table) => ({
      orgUnique: uniqueIndex('cloudflare_dns_org_config_org_idx').on(table.organizationId)
    })
  )

  /**
   * Cloudflare DNS zones cache
   * Caches zone information for faster lookups.
   */
  const cloudflareDnsZonesCache = mysqlTable(
    'cloudflare_dns_zones_cache',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      name: varchar('name', { length: 255 }).notNull(),
      status: varchar('status', { length: 50 }),
      plan: text('plan'),
      recordCount: int('record_count'),
      lastSyncedAt: timestamp('last_synced_at', { fsp: 3 }),
      ...timestampColumns()
    },
    (table) => ({
      orgZoneIdx: uniqueIndex('cloudflare_dns_zones_cache_org_zone_idx').on(
        table.organizationId,
        table.zoneId
      ),
      orgIdx: index('cloudflare_dns_zones_cache_org_idx').on(table.organizationId)
    })
  )

  /**
   * Cloudflare DNS zone access control lists
   * Controls who can access which zones within an organization.
   */
  const cloudflareDnsZoneAcls = mysqlTable(
    'cloudflare_dns_zone_acls',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      principalType: varchar('principal_type', { length: 50 })
        .$type<'user' | 'org-role'>()
        .notNull(),
      principalId: varchar('principal_id', { length: 255 }).notNull(),
      role: varchar('role', { length: 50 })
        .$type<'viewer' | 'editor' | 'admin' | 'records-only'>()
        .notNull(),
      ...timestampColumns()
    },
    (table) => ({
      zoneIdx: index('cloudflare_dns_zone_acls_zone_idx').on(table.organizationId, table.zoneId),
      principalIdx: index('cloudflare_dns_zone_acls_principal_idx').on(
        table.organizationId,
        table.principalType,
        table.principalId
      )
    })
  )

  return {
    cloudflareDnsOrgConfig,
    cloudflareDnsZonesCache,
    cloudflareDnsZoneAcls
  }
}

// Export types for use in the layer
export type CloudflareDnsSchema = ReturnType<typeof createCloudflareDnsSchema>
