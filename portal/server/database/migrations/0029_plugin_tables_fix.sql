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
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_permissions_module_perm_idx` ON `module_permissions` (`module_key`,`permission_key`);

CREATE TABLE IF NOT EXISTS `module_role_permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `module_key` text NOT NULL,
  `role_key` text NOT NULL,
  `permission_key` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_role_permissions_idx` ON `module_role_permissions` (`module_key`,`role_key`,`permission_key`);

CREATE TABLE IF NOT EXISTS `module_role_defaults` (
  `id` text PRIMARY KEY NOT NULL,
  `module_key` text NOT NULL,
  `app_role_key` text NOT NULL,
  `module_role_key` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `module_role_defaults_idx` ON `module_role_defaults` (`module_key`,`app_role_key`);


