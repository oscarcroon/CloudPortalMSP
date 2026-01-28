-- Create MSP Roles tables for dynamic role management
-- This allows tenants to define custom MSP roles with specific module permissions

-- MSP Roles table
CREATE TABLE IF NOT EXISTS `msp_roles` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  `key` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- MSP Role Permissions table
CREATE TABLE IF NOT EXISTS `msp_role_permissions` (
  `role_id` text NOT NULL REFERENCES `msp_roles`(`id`) ON DELETE CASCADE,
  `module_key` text NOT NULL,
  `permission_key` text NOT NULL,
  PRIMARY KEY (`role_id`, `module_key`, `permission_key`)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS `msp_roles_tenant_key_unique` ON `msp_roles` (`tenant_id`, `key`);
CREATE INDEX IF NOT EXISTS `msp_roles_tenant_idx` ON `msp_roles` (`tenant_id`);
CREATE INDEX IF NOT EXISTS `msp_role_permissions_role_idx` ON `msp_role_permissions` (`role_id`);
CREATE INDEX IF NOT EXISTS `msp_role_permissions_module_idx` ON `msp_role_permissions` (`module_key`);
