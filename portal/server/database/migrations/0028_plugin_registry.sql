-- Plugin registry core tables
CREATE TABLE IF NOT EXISTS `modules` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `category` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `modules_key_unique` ON `modules` (`key`);
CREATE INDEX IF NOT EXISTS `modules_key_idx` ON `modules` (`key`);

CREATE TABLE IF NOT EXISTS `module_permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `module_key` text NOT NULL,
  `permission_key` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_permissions_module_perm_idx` ON `module_permissions` (`module_key`,`permission_key`);

-- Align existing module_roles table with plugin roles (add sort_order)
ALTER TABLE `module_roles` ADD COLUMN `sort_order` integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS `module_role_permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `module_key` text NOT NULL,
  `role_key` text NOT NULL,
  `permission_key` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_role_permissions_idx` ON `module_role_permissions` (`module_key`,`role_key`,`permission_key`);

CREATE TABLE IF NOT EXISTS `module_role_defaults` (
  `id` text PRIMARY KEY NOT NULL,
  `module_key` text NOT NULL,
  `app_role_key` text NOT NULL,
  `module_role_key` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_role_defaults_idx` ON `module_role_defaults` (`module_key`,`app_role_key`);

-- Windows DNS tables
CREATE TABLE IF NOT EXISTS `windows_dns_zones` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `windows_dns_zones_org_idx` ON `windows_dns_zones` (`organization_id`);

CREATE TABLE IF NOT EXISTS `windows_dns_zone_memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `zone_id` text NOT NULL,
  `principal_type` text NOT NULL,
  `principal_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`zone_id`) REFERENCES `windows_dns_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `windows_dns_zone_memberships_zone_idx` ON `windows_dns_zone_memberships` (`organization_id`,`zone_id`);
CREATE INDEX IF NOT EXISTS `windows_dns_zone_memberships_principal_idx` ON `windows_dns_zone_memberships` (`organization_id`,`principal_type`,`principal_id`);




