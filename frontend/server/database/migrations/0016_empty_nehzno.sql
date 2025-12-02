CREATE TABLE `tenant_member_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text NOT NULL,
	`role_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_member_roles_membership_role_unique` ON `tenant_member_roles` (`membership_id`,`role_key`);--> statement-breakpoint
CREATE INDEX `tenant_member_roles_membership_idx` ON `tenant_member_roles` (`membership_id`);--> statement-breakpoint
CREATE TABLE `user_module_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_module_favorites_unique` ON `user_module_favorites` (`user_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `user_module_favorites_order_idx` ON `user_module_favorites` (`user_id`,`display_order`);--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `app_logo_light_url` text;--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `app_logo_dark_url` text;--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `login_logo_light_url` text;--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `login_logo_dark_url` text;--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `login_background_url` text;--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `login_background_tint` text(16);--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `navigation_background_color` text(16);--> statement-breakpoint
ALTER TABLE `branding_themes` ADD `login_background_tint_opacity` real;--> statement-breakpoint
ALTER TABLE `tenants` ADD `custom_domain` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `custom_domain_verification_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `custom_domain_verified_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_idx` ON `tenants` (`custom_domain`);