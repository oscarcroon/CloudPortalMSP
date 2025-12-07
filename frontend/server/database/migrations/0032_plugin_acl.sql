-- Organization groups for plugin ACL
CREATE TABLE IF NOT EXISTS `org_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `org_groups_org_name_unique` ON `org_groups` (`organization_id`,`name`);
CREATE INDEX IF NOT EXISTS `org_groups_org_idx` ON `org_groups` (`organization_id`);

CREATE TABLE IF NOT EXISTS `org_group_members` (
  `id` text PRIMARY KEY NOT NULL,
  `group_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `org_group_members_unique` ON `org_group_members` (`group_id`,`user_id`);
CREATE INDEX IF NOT EXISTS `org_group_members_group_idx` ON `org_group_members` (`group_id`);

CREATE TABLE IF NOT EXISTS `plugin_acl_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `plugin_key` text NOT NULL,
  `operation` text NOT NULL,
  `group_id` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `plugin_acl_org_plugin_op_idx` ON `plugin_acl_entries` (`organization_id`,`plugin_key`,`operation`);
CREATE UNIQUE INDEX IF NOT EXISTS `plugin_acl_unique` ON `plugin_acl_entries` (`organization_id`,`plugin_key`,`operation`,`group_id`);


