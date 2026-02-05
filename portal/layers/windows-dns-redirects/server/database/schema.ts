/**
 * WindowsDnsRedirects Database Schema
 * Uses factory pattern to allow integration with the main app's organization table
 */

import { mysqlTable, varchar, text, int, boolean, timestamp, json, index, uniqueIndex, foreignKey } from 'drizzle-orm/mysql-core'
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core'
import { createId } from '@paralleldrive/cuid2'

/**
 * Factory function to create the WindowsDnsRedirects schema
 * Follows the same pattern as createWindowsDnsSchema in the windows-dns layer
 */
export function createWindowsDnsRedirectsSchema(
  organizationsIdColumn: AnyMySqlColumn
) {
  // Main redirects table
  const windowsDnsRedirects = mysqlTable(
    'windows_dns_redirects',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: varchar('zone_id', { length: 128 }).notNull(),
      zoneName: varchar('zone_name', { length: 255 }).notNull(),
      /**
       * Full hostname (e.g. "example.com", "www.example.com").
       * For legacy rows, this may be an empty string; treat as zoneName (apex).
       */
      host: varchar('host', { length: 255 }).notNull().default(''),
      sourcePath: varchar('source_path', { length: 255 }).notNull(),
      destinationUrl: text('destination_url').notNull(),
      redirectType: varchar('redirect_type', { length: 50 })
        .notNull()
        .default('simple'),
      statusCode: int('status_code').notNull().default(301),
      isActive: boolean('is_active').notNull().default(true),
      hitCount: int('hit_count').notNull().default(0),
      lastHitAt: timestamp('last_hit_at', { fsp: 3 }),
      createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
      createdBy: varchar('created_by', { length: 255 }).notNull(),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirects_org_id_idx').on(table.organizationId),
      zoneIdIdx: index('windows_dns_redirects_zone_id_idx').on(table.zoneId),
      orgZoneIdx: index('windows_dns_redirects_org_zone_idx').on(
        table.organizationId,
        table.zoneId
      ),
      orgZoneHostIdx: index('windows_dns_redirects_org_zone_host_idx').on(
        table.organizationId,
        table.zoneId,
        table.host
      ),
      // Unique constraint: no duplicate (host, sourcePath) per org+zone
      uniqueHostPath: uniqueIndex('windows_dns_redirects_unique_host_path').on(
        table.organizationId,
        table.zoneId,
        table.host,
        table.sourcePath
      ),
    })
  )

  // Redirect hits table for daily aggregation
  const windowsDnsRedirectHits = mysqlTable(
    'windows_dns_redirect_hits',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
      redirectId: varchar('redirect_id', { length: 128 })
        .notNull(),
      hitDate: varchar('hit_date', { length: 255 }).notNull(), // YYYY-MM-DD format for easy aggregation
      hitCount: int('hit_count').notNull().default(0),
      createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
    },
    (table) => ({
      redirectIdIdx: index('windows_dns_redirect_hits_redirect_id_idx').on(table.redirectId),
      dateIdx: index('windows_dns_redirect_hits_date_idx').on(table.hitDate),
      redirectFk: foreignKey({
        name: 'wdns_redir_hits_redirect_id_fk',
        columns: [table.redirectId],
        foreignColumns: [windowsDnsRedirects.id]
      }).onDelete('cascade'),
    })
  )

  // Organization configuration table
  const windowsDnsRedirectOrgConfig = mysqlTable(
    'windows_dns_redirect_org_config',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull()
        .unique(),
      traefikConfigPath: text('traefik_config_path'),
      lastConfigSync: timestamp('last_config_sync', { fsp: 3 }),
      // SFTP sync configuration
      syncMode: varchar('sync_mode', { length: 50 }).notNull().default('local'),
      sftpHost: varchar('sftp_host', { length: 255 }),
      sftpPort: int('sftp_port').default(22),
      sftpUsername: varchar('sftp_username', { length: 255 }),
      sftpKeyPath: text('sftp_key_path'),
      sftpRemotePath: text('sftp_remote_path'),
      sftpConnectionStatus: varchar('sftp_connection_status', { length: 50 }).default('unknown'),
      sftpLastConnectionTest: timestamp('sftp_last_connection_test', { fsp: 3 }),
      sftpLastConnectionError: text('sftp_last_connection_error'),
      createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirect_org_config_org_id_idx').on(table.organizationId),
      orgFk: foreignKey({
        name: 'wdns_redir_org_config_org_id_fk',
        columns: [table.organizationId],
        foreignColumns: [organizationsIdColumn]
      }).onDelete('cascade'),
    })
  )

  // Import logs table for tracking bulk imports
  const windowsDnsRedirectImportLogs = mysqlTable(
    'windows_dns_redirect_import_logs',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
      organizationId: varchar('organization_id', { length: 128 })
        .notNull(),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      filename: varchar('filename', { length: 255 }).notNull(),
      totalRows: int('total_rows').notNull(),
      successfulRows: int('successful_rows').notNull(),
      failedRows: int('failed_rows').notNull(),
      errorDetails: json('error_details'), // JSON array of errors
      importedBy: varchar('imported_by', { length: 255 }).notNull(),
      createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirect_import_logs_org_id_idx').on(table.organizationId),
      zoneIdIdx: index('windows_dns_redirect_import_logs_zone_id_idx').on(table.zoneId),
      orgFk: foreignKey({
        name: 'wdns_redir_import_logs_org_id_fk',
        columns: [table.organizationId],
        foreignColumns: [organizationsIdColumn]
      }).onDelete('cascade'),
    })
  )

  /**
   * Managed DNS records table - tracks which DNS records are managed by redirects.
   * This provides a robust source of truth beyond just comment prefixes.
   *
   * For apex records (A/AAAA), managedBy='redirects_shared' and managedId=null
   * (shared across all redirects for that zone).
   * For CNAME records, managedBy='redirects' and managedId=redirectId
   * (owned by a specific redirect).
   */
  const windowsDnsManagedRecords = mysqlTable(
    'windows_dns_managed_records',
    {
      id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
      zoneId: varchar('zone_id', { length: 255 }).notNull(),
      /**
       * Record key format: "<type>|<name>" e.g. "A|@", "CNAME|www", "AAAA|@"
       */
      recordKey: varchar('record_key', { length: 255 }).notNull(),
      /**
       * What manages this record: 'redirects' (specific redirect) or 'redirects_shared' (apex shared)
       */
      managedBy: varchar('managed_by', { length: 50 }).notNull(),
      /**
       * For 'redirects': the redirect ID that owns this record.
       * For 'redirects_shared': null (apex records shared by all redirects).
       */
      managedId: varchar('managed_id', { length: 128 }),
      lastAppliedByUserId: varchar('last_applied_by_user_id', { length: 255 }),
      lastAppliedAt: timestamp('last_applied_at', { fsp: 3 }),
      createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow(),
    },
    (table) => ({
      zoneIdIdx: index('windows_dns_managed_records_zone_id_idx').on(table.zoneId),
      managedIdIdx: index('windows_dns_managed_records_managed_id_idx').on(table.managedId),
      zoneManagerIdx: index('windows_dns_managed_records_zone_manager_idx').on(
        table.zoneId,
        table.managedBy
      ),
      // Unique: one manager per record key per zone
      uniqueZoneRecordManager: uniqueIndex('windows_dns_managed_records_unique').on(
        table.zoneId,
        table.recordKey,
        table.managedBy
      ),
    })
  )

  return {
    windowsDnsRedirects,
    windowsDnsRedirectHits,
    windowsDnsRedirectOrgConfig,
    windowsDnsRedirectImportLogs,
    windowsDnsManagedRecords,
  }
}

// Type exports for Drizzle
export type WindowsDnsRedirectsSchemaType = ReturnType<typeof createWindowsDnsRedirectsSchema>
export type WindowsDnsRedirectRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirects']['$inferSelect']
export type NewWindowsDnsRedirectRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirects']['$inferInsert']
export type WindowsDnsRedirectHitRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectHits']['$inferSelect']
export type NewWindowsDnsRedirectHitRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectHits']['$inferInsert']
export type WindowsDnsRedirectOrgConfigRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectOrgConfig']['$inferSelect']
export type NewWindowsDnsRedirectOrgConfigRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectOrgConfig']['$inferInsert']
export type WindowsDnsRedirectImportLogRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectImportLogs']['$inferSelect']
export type NewWindowsDnsRedirectImportLogRecord = WindowsDnsRedirectsSchemaType['windowsDnsRedirectImportLogs']['$inferInsert']
export type WindowsDnsManagedRecordRecord = WindowsDnsRedirectsSchemaType['windowsDnsManagedRecords']['$inferSelect']
export type NewWindowsDnsManagedRecordRecord = WindowsDnsRedirectsSchemaType['windowsDnsManagedRecords']['$inferInsert']
