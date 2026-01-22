-- Migration 0044: Add template support to msp_roles
-- Enables distributor-level role templates that can be published and used by providers

-- Template vs Role discrimination
ALTER TABLE `msp_roles` ADD COLUMN `role_kind` text NOT NULL DEFAULT 'role';
ALTER TABLE `msp_roles` ADD COLUMN `source_template_id` text REFERENCES `msp_roles`(`id`) ON DELETE SET NULL;
ALTER TABLE `msp_roles` ADD COLUMN `published_at` integer;
ALTER TABLE `msp_roles` ADD COLUMN `template_version` integer NOT NULL DEFAULT 1;

-- Sync metadata (for roles derived from templates)
ALTER TABLE `msp_roles` ADD COLUMN `source_template_version` integer;
ALTER TABLE `msp_roles` ADD COLUMN `last_synced_at` integer;
ALTER TABLE `msp_roles` ADD COLUMN `permissions_fingerprint` text;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS `msp_roles_kind_tenant_idx` ON `msp_roles` (`tenant_id`, `role_kind`);
CREATE INDEX IF NOT EXISTS `msp_roles_source_template_idx` ON `msp_roles` (`source_template_id`);
