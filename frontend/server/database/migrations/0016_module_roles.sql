ALTER TABLE `tenant_module_policies` ADD COLUMN `allowed_roles` text;

ALTER TABLE `organization_module_policies` ADD COLUMN `allowed_roles` text;

CREATE TABLE `module_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`role_key` text NOT NULL,
	`role_name` text NOT NULL,
	`description` text,
	`capabilities` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `module_roles_module_role_idx` ON `module_roles` (`module_id`,`role_key`);
--> statement-breakpoint
CREATE INDEX `module_roles_module_idx` ON `module_roles` (`module_id`);

CREATE TABLE `user_module_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`context_type` text NOT NULL,
	`context_id` text NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`role_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_module_roles_unique` ON `user_module_roles` (
	`context_type`,
	`context_id`,
	`user_id`,
	`module_id`,
	`role_key`
);
--> statement-breakpoint
CREATE INDEX `user_module_roles_user_idx` ON `user_module_roles` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_module_roles_module_idx` ON `user_module_roles` (`module_id`);

