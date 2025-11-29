CREATE TABLE `email_provider_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`organization_id` text,
	`provider_type` text NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`from_name` text,
	`from_email` text,
	`reply_to_email` text,
	`branding_config` text(4096),
	`encrypted_config` text(8192),
	`encryption_iv` text,
	`encryption_auth_tag` text,
	`config_version` integer DEFAULT 1 NOT NULL,
	`last_tested_at` integer,
	`last_test_status` text,
	`last_test_error` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_provider_target_key_idx` ON `email_provider_profiles` (`target_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_provider_org_unique` ON `email_provider_profiles` (`organization_id`);--> statement-breakpoint
CREATE TABLE `monitoring_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text(1024),
	`severity` text DEFAULT 'info' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`source` text,
	`triggered_at` integer,
	`resolved_at` integer,
	`metadata` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ncentral_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'online' NOT NULL,
	`type` text DEFAULT 'server' NOT NULL,
	`os_version` text,
	`region` text,
	`last_seen_at` integer,
	`metadata` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ncentral_devices_org_name_idx` ON `ncentral_devices` (`organization_id`,`name`);