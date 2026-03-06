/**
 * Windows DNS Plugin Schema
 *
 * This schema is owned by the windows-dns layer and imported into the core schema.
 * All tables are prefixed with 'windows_dns_' to avoid conflicts.
 */

import { createId } from '@paralleldrive/cuid2'
import {
  index,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/mysql-core'

// We need a reference to the organizations table for foreign keys
// This will be resolved when imported into core schema
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core'

const timestampColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow()
})

/**
 * Factory function to create the Windows DNS schema with proper foreign key references.
 * This allows the layer to define its schema while still referencing the core organizations table.
 */
export function createWindowsDnsSchema(organizationsIdColumn: AnyMySqlColumn) {
  const windowsDnsZones = mysqlTable(
    'windows_dns_zones',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      name: varchar('name', { length: 255 }).notNull(),
      description: text('description'),
      ...timestampColumns()
    },
    (table) => ({
      orgIdx: index('windows_dns_zones_org_idx').on(table.organizationId)
    })
  )

  const windowsDnsZoneMemberships = mysqlTable(
    'windows_dns_zone_memberships',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 128 })
        .notNull()
        .references(() => windowsDnsZones.id, { onDelete: 'cascade' }),
      principalType: varchar('principal_type', { length: 50 })
        .$type<'user' | 'org-role'>()
        .notNull(),
      principalId: varchar('principal_id', { length: 255 }).notNull(),
      role: varchar('role', { length: 50 })
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
  const windowsDnsOrgConfig = mysqlTable(
    'windows_dns_org_config',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .unique()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      windowsDnsAccountId: varchar('windows_dns_account_id', { length: 255 }),
      instanceId: varchar('instance_id', { length: 255 }),
      enabledAt: timestamp('enabled_at', { fsp: 3 }),
      lastValidatedAt: timestamp('last_validated_at', { fsp: 3 }),
      lastSyncAt: timestamp('last_sync_at', { fsp: 3 }),
      lastSyncStatus: varchar('last_sync_status', { length: 50 }),
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
  const windowsDnsAllowedZones = mysqlTable(
    'windows_dns_allowed_zones',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      zoneName: varchar('zone_name', { length: 255 }),
      source: varchar('source', { length: 50 })
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
  const windowsDnsLastDiscovery = mysqlTable(
    'windows_dns_last_discovery',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .unique()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      discoveredAt: timestamp('discovered_at', { fsp: 3 }).notNull(),
      zoneIdsJson: text('zone_ids_json').notNull(),
      coreIdSnapshot: varchar('core_id_snapshot', { length: 255 }),
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
  const windowsDnsBlockedZones = mysqlTable(
    'windows_dns_blocked_zones',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      zoneName: varchar('zone_name', { length: 255 }),
      source: varchar('source', { length: 50 })
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
