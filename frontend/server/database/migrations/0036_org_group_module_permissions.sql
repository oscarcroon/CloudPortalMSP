-- Org group → module permission bindings (grant/deny)
CREATE TABLE IF NOT EXISTS `org_group_module_permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `group_id` text NOT NULL,
  `module_key` text NOT NULL,
  `permission_key` text NOT NULL,
  `effect` text NOT NULL, -- 'grant' | 'deny'
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `org_group_module_permissions_unique` ON `org_group_module_permissions`
  (`organization_id`, `group_id`, `module_key`, `permission_key`);

CREATE INDEX IF NOT EXISTS `org_group_module_permissions_group_idx` ON `org_group_module_permissions`
  (`group_id`);

CREATE INDEX IF NOT EXISTS `org_group_module_permissions_module_idx` ON `org_group_module_permissions`
  (`module_key`, `permission_key`);




