-- Migration to add user-specific module permissions
-- This allows granular control over which permissions a user has for specific modules
-- Can only restrict (deny) permissions, not expand beyond the user's role

CREATE TABLE IF NOT EXISTS `user_module_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`denied_permissions` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index for organization + user + module combination
CREATE UNIQUE INDEX IF NOT EXISTS `user_module_permission_unique` ON `user_module_permissions` (`organization_id`, `user_id`, `module_id`);

-- Create index for efficient lookups by organization and user
CREATE INDEX IF NOT EXISTS `user_module_permission_user_org_idx` ON `user_module_permissions` (`organization_id`, `user_id`);

