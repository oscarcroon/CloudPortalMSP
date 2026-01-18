/**
 * WindowsDnsRedirects Database Schema
 * Uses factory pattern to allow integration with the main app's organization table
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

/**
 * Factory function to create the WindowsDnsRedirects schema
 * Follows the same pattern as createWindowsDnsSchema in the windows-dns layer
 */
export function createWindowsDnsRedirectsSchema(
  organizationsIdColumn: AnySQLiteColumn
) {
  // Main redirects table
  const windowsDnsRedirects = sqliteTable(
    'windows_dns_redirects',
    {
      id: text('id').primaryKey().$defaultFn(() => createId()),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      zoneName: text('zone_name').notNull(),
      sourcePath: text('source_path').notNull(),
      destinationUrl: text('destination_url').notNull(),
      redirectType: text('redirect_type', { enum: ['simple', 'wildcard', 'regex'] })
        .notNull()
        .default('simple'),
      statusCode: integer('status_code').notNull().default(301),
      isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
      hitCount: integer('hit_count').notNull().default(0),
      lastHitAt: integer('last_hit_at', { mode: 'timestamp' }),
      createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
      updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
      createdBy: text('created_by').notNull(),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirects_org_id_idx').on(table.organizationId),
      zoneIdIdx: index('windows_dns_redirects_zone_id_idx').on(table.zoneId),
      orgZoneIdx: index('windows_dns_redirects_org_zone_idx').on(
        table.organizationId,
        table.zoneId
      ),
    })
  )

  // Redirect hits table for daily aggregation
  const windowsDnsRedirectHits = sqliteTable(
    'windows_dns_redirect_hits',
    {
      id: text('id').primaryKey().$defaultFn(() => createId()),
      redirectId: text('redirect_id')
        .notNull()
        .references(() => windowsDnsRedirects.id, { onDelete: 'cascade' }),
      hitDate: text('hit_date').notNull(), // YYYY-MM-DD format for easy aggregation
      hitCount: integer('hit_count').notNull().default(0),
      createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
      redirectIdIdx: index('windows_dns_redirect_hits_redirect_id_idx').on(table.redirectId),
      dateIdx: index('windows_dns_redirect_hits_date_idx').on(table.hitDate),
    })
  )

  // Organization configuration table
  const windowsDnsRedirectOrgConfig = sqliteTable(
    'windows_dns_redirect_org_config',
    {
      id: text('id').primaryKey().$defaultFn(() => createId()),
      organizationId: text('organization_id')
        .notNull()
        .unique()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      traefikConfigPath: text('traefik_config_path'),
      lastConfigSync: integer('last_config_sync', { mode: 'timestamp' }),
      createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
      updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirect_org_config_org_id_idx').on(table.organizationId),
    })
  )

  // Import logs table for tracking bulk imports
  const windowsDnsRedirectImportLogs = sqliteTable(
    'windows_dns_redirect_import_logs',
    {
      id: text('id').primaryKey().$defaultFn(() => createId()),
      organizationId: text('organization_id')
        .notNull()
        .references(() => organizationsIdColumn, { onDelete: 'cascade' }),
      zoneId: text('zone_id').notNull(),
      filename: text('filename').notNull(),
      totalRows: integer('total_rows').notNull(),
      successfulRows: integer('successful_rows').notNull(),
      failedRows: integer('failed_rows').notNull(),
      errorDetails: text('error_details', { mode: 'json' }), // JSON array of errors
      importedBy: text('imported_by').notNull(),
      createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    },
    (table) => ({
      orgIdIdx: index('windows_dns_redirect_import_logs_org_id_idx').on(table.organizationId),
      zoneIdIdx: index('windows_dns_redirect_import_logs_zone_id_idx').on(table.zoneId),
    })
  )

  return {
    windowsDnsRedirects,
    windowsDnsRedirectHits,
    windowsDnsRedirectOrgConfig,
    windowsDnsRedirectImportLogs,
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
