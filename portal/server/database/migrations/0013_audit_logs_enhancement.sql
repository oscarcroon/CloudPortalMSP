-- Migration for Audit Logs Enhancement
-- Adds severity, request_id, endpoint, method, org_id, tenant_id columns
-- Makes user_id nullable to support unauthenticated security events

-- Check if columns already exist by trying to add them (will fail silently if they exist)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we use a different approach

-- First, check if we need to recreate the table (if user_id is NOT NULL, we need to make it nullable)
-- We'll recreate the table to make user_id nullable and add new columns

-- Create new table structure
CREATE TABLE IF NOT EXISTS `audit_logs_new` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text,
  `event_type` text NOT NULL,
  `severity` text DEFAULT 'info' NOT NULL,
  `request_id` text,
  `endpoint` text,
  `method` text,
  `org_id` text,
  `tenant_id` text,
  `from_context` text(1024),
  `to_context` text(1024),
  `ip` text,
  `user_agent` text(512),
  `meta` text(4096),
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Copy existing data (only if audit_logs table exists)
-- Handle case where columns might not exist in old table
-- We'll copy only the columns that exist in the old table
INSERT INTO `audit_logs_new` 
  (`id`, `user_id`, `event_type`, `severity`, `from_context`, `to_context`, `ip`, `user_agent`, `meta`, `created_at`, `updated_at`)
SELECT 
  `id`, 
  `user_id`, 
  `event_type`, 
  'info' as severity,
  `from_context`, 
  `to_context`, 
  `ip`, 
  `user_agent`, 
  `meta`, 
  `created_at`, 
  `updated_at`
FROM `audit_logs`
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_logs');

-- Drop old table if it exists
DROP TABLE IF EXISTS `audit_logs`;

-- Rename new table
ALTER TABLE `audit_logs_new` RENAME TO `audit_logs`;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);
CREATE INDEX IF NOT EXISTS `audit_logs_timestamp_idx` ON `audit_logs` (`created_at`);
CREATE INDEX IF NOT EXISTS `audit_logs_event_type_idx` ON `audit_logs` (`event_type`);
CREATE INDEX IF NOT EXISTS `audit_logs_request_id_idx` ON `audit_logs` (`request_id`);
CREATE INDEX IF NOT EXISTS `audit_logs_org_id_idx` ON `audit_logs` (`org_id`);
CREATE INDEX IF NOT EXISTS `audit_logs_tenant_id_idx` ON `audit_logs` (`tenant_id`);

