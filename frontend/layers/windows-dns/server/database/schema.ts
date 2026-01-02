/**
 * Windows DNS Plugin Schema
 * 
 * This schema is owned by the windows-dns layer and imported into the core schema.
 * All tables are prefixed with 'windows_dns_' to avoid conflicts.
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

// We need a reference to the organizations table for foreign keys
// This will be resolved when imported into core schema
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
 * Factory function to create the Windows DNS schema with proper foreign key references.
 * This allows the layer to define its schema while still referencing the core organizations table.
 */
export function createWindowsDnsSchema(organizationsIdColumn: AnySQLiteColumn) {
  const windowsDnsZones = sqliteTable(
    'windows_dns_zones',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      name: text('name').notNull(),
      description: text('description'),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('windows_dns_zones_org_idx').on(table.organizationId)
    })
  )

  const windowsDnsZoneMemberships = sqliteTable(
    'windows_dns_zone_memberships',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id')
        .notNull()
        .references(() => windowsDnsZones.id, { onDelete: 'cascade' }),
      principalType: text('principal_type', { enum: ['user', 'org-role'] })
        .$type<'user' | 'org-role'>()
        .notNull(),
      principalId: text('principal_id').notNull(),
      role: text('role', { enum: ['viewer', 'editor', 'admin'] })
        .$type<'viewer' | 'editor' | 'admin'>()
        .notNull(),
      ...timestampColumns()
    },
    (table) => ({
      zoneIdx: index('windows_dns_zone_memberships_zone_idx').on(table.organizationId, table.zoneId),
      principalIdx: index('windows_dns_zone_memberships_principal_idx').on(
        table.organizationId,
        table.principalType,
        table.principalId
      )
    })
  )

  /**
   * Windows DNS org configuration (COREID-first model)
   * Stores the WindowsDNS account binding. CoreID is derived from organizations.core_id.
   */
  const windowsDnsOrgConfig = sqliteTable(
    'windows_dns_org_config',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .unique()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      windowsDnsAccountId: text('windows_dns_account_id'),
      instanceId: text('instance_id'),
      enabledAt: integer('enabled_at', { mode: 'timestamp_ms' }),
      lastValidatedAt: integer('last_validated_at', { mode: 'timestamp_ms' }),
      lastSyncAt: integer('last_sync_at', { mode: 'timestamp_ms' }),
      lastSyncStatus: text('last_sync_status'),
      lastSyncError: text('last_sync_error'),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('windows_dns_org_config_org_idx').on(table.organizationId)
    })
  )

  /**
   * Windows DNS allowed zones (allowlist per org)
   * External zone IDs from the WindowsDNS layer that this org is allowed to access.
   */
  const windowsDnsAllowedZones = sqliteTable(
    'windows_dns_allowed_zones',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      zoneName: text('zone_name'),
      source: text('source')
        .notNull()
        .default('autodiscover')
        .$type<'autodiscover' | 'manual'>(),
      ...timestampColumns()
    },
    (table) => ({
      orgZoneUnique: uniqueIndex('windows_dns_allowed_zones_org_zone_unique').on(
        table.organizationId,
        table.zoneId
      ),
      orgIdx: index('windows_dns_allowed_zones_org_idx').on(table.organizationId)
    })
  )

  /**
   * Windows DNS last discovery result (for validating activate requests)
   */
  const windowsDnsLastDiscovery = sqliteTable(
    'windows_dns_last_discovery',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .unique()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      discoveredAt: integer('discovered_at', { mode: 'timestamp_ms' }).notNull(),
      zoneIdsJson: text('zone_ids_json').notNull(),
      coreIdSnapshot: text('core_id_snapshot'),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('windows_dns_last_discovery_org_idx').on(table.organizationId)
    })
  )

  /**
   * Windows DNS blocked zones (blocklist per org)
   * Zones that have been explicitly hidden by admin and should not be auto-activated.
   */
  const windowsDnsBlockedZones = sqliteTable(
    'windows_dns_blocked_zones',
    {
      id: text('id').primaryKey().$defaultFn(createId),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      zoneName: text('zone_name'),
      source: text('source')
        .notNull()
        .default('manual')
        .$type<'manual'>(),
      ...timestampColumns()
    },
    (table) => ({
      orgZoneUnique: uniqueIndex('windows_dns_blocked_zones_org_zone_unique').on(
        table.organizationId,
        table.zoneId
      ),
      orgIdx: index('windows_dns_blocked_zones_org_idx').on(table.organizationId)
    })
  )

  return {
    windowsDnsZones,
    windowsDnsZoneMemberships,
    windowsDnsOrgConfig,
    windowsDnsAllowedZones,
    windowsDnsLastDiscovery,
    windowsDnsBlockedZones
  }
}

// Export types for use in the layer
export type WindowsDnsSchema = ReturnType<typeof createWindowsDnsSchema>

