CREATE TABLE `role_module_role_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`module_role_key` text NOT NULL,
	`rbac_role` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_module_role_mapping_unique` ON `role_module_role_mappings` (`rbac_role`,`module_id`,`module_role_key`);
--> statement-breakpoint
CREATE INDEX `role_module_role_mapping_module_idx` ON `role_module_role_mappings` (`module_id`);
--> statement-breakpoint

CREATE TABLE `member_module_role_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`role_key` text NOT NULL,
	`effect` text NOT NULL,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CHECK (`effect` IN ('grant','deny'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_module_role_overrides_unique` ON `member_module_role_overrides` (`organization_id`,`user_id`,`module_id`,`role_key`);
--> statement-breakpoint
CREATE INDEX `member_module_role_overrides_org_idx` ON `member_module_role_overrides` (`organization_id`,`module_id`);
--> statement-breakpoint

DROP TABLE IF EXISTS `user_module_roles`;

