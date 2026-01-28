-- Migration: 0050_tenant_incident_user_mutes
-- Description: Add table for per-user incident mutes (personal "hide" functionality)

-- Per-user incident mutes
-- Allows individual users to hide incidents for themselves only.
CREATE TABLE IF NOT EXISTS `tenant_incident_user_mutes` (
  `id` text PRIMARY KEY NOT NULL,
  `incident_id` text NOT NULL REFERENCES `tenant_incidents`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `muted_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `mute_until` integer
);

CREATE INDEX IF NOT EXISTS `tenant_incident_user_mutes_incident_idx` ON `tenant_incident_user_mutes`(`incident_id`);
CREATE INDEX IF NOT EXISTS `tenant_incident_user_mutes_user_idx` ON `tenant_incident_user_mutes`(`user_id`, `muted_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `tenant_incident_user_mutes_unique` ON `tenant_incident_user_mutes`(`incident_id`, `user_id`);

-- Add audit fields to existing scope mutes table for traceability
-- (muted_by_user_id already exists, adding muted_reason)
ALTER TABLE `tenant_incident_mutes` ADD COLUMN `muted_reason` text;

