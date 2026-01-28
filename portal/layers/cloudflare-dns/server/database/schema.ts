/**
 * Cloudflare DNS Plugin Schema
 * 
 * This schema is owned by the cloudflare-dns layer and imported into the core schema.
 * All tables are prefixed with 'cloudflare_dns_' to avoid conflicts.
 */

import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

const timestampColumns = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' } as const)
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' } as const)
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`)
})

/**
 * Factory function to create the Cloudflare DNS schema with proper foreign key references.
 * This allows the layer to define its schema while still referencing the core organizations table.
 */
export function createCloudflareDnsSchema(organizationsIdColumn: AnySQLiteColumn) {
  /**
   * Cloudflare DNS organization configuration
   * Stores encrypted API tokens and sync status per organization.
   */
  const cloudflareDnsOrgConfig = sqliteTable(
    'cloudflare_dns_org_config',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      encryptedApiToken: text('encrypted_api_token', { length: 4096 }).notNull(),
      encryptionIv: text('encryption_iv').notNull(),
      encryptionAuthTag: text('encryption_auth_tag').notNull(),
      accountId: text('account_id'),
      lastSyncAt: integer('last_sync_at', { mode: 'timestamp_ms' }),
      lastSyncStatus: text('last_sync_status'),
      lastSyncError: text('last_sync_error'),
      lastValidatedAt: integer('last_validated_at', { mode: 'timestamp_ms' }),
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
  const cloudflareDnsZonesCache = sqliteTable(
    'cloudflare_dns_zones_cache',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      name: text('name').notNull(),
      status: text('status'),
      plan: text('plan'),
      recordCount: integer('record_count'),
      lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
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
  const cloudflareDnsZoneAcls = sqliteTable(
    'cloudflare_dns_zone_acls',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      principalType: text('principal_type', { enum: ['user', 'org-role'] })
        .$type<'user' | 'org-role'>()
        .notNull(),
      principalId: text('principal_id').notNull(),
      role: text('role', {
        enum: ['viewer', 'editor', 'admin', 'records-only']
      })
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

