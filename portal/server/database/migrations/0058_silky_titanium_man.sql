CREATE TABLE `windows_dns_redirect_hits` (
	`id` text PRIMARY KEY NOT NULL,
	`redirect_id` text NOT NULL,
	`hit_date` text NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`redirect_id`) REFERENCES `windows_dns_redirects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `windows_dns_redirect_hits_redirect_id_idx` ON `windows_dns_redirect_hits` (`redirect_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_redirect_hits_date_idx` ON `windows_dns_redirect_hits` (`hit_date`);--> statement-breakpoint
CREATE TABLE `windows_dns_redirect_import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`filename` text NOT NULL,
	`total_rows` integer NOT NULL,
	`successful_rows` integer NOT NULL,
	`failed_rows` integer NOT NULL,
	`error_details` text,
	`imported_by` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `windows_dns_redirect_import_logs_org_id_idx` ON `windows_dns_redirect_import_logs` (`organization_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_redirect_import_logs_zone_id_idx` ON `windows_dns_redirect_import_logs` (`zone_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_redirect_org_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`traefik_config_path` text,
	`last_config_sync` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_redirect_org_config_organization_id_unique` ON `windows_dns_redirect_org_config` (`organization_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_redirect_org_config_org_id_idx` ON `windows_dns_redirect_org_config` (`organization_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`zone_name` text NOT NULL,
	`source_path` text NOT NULL,
	`destination_url` text NOT NULL,
	`redirect_type` text DEFAULT 'simple' NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`last_hit_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `windows_dns_redirects_org_id_idx` ON `windows_dns_redirects` (`organization_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_redirects_zone_id_idx` ON `windows_dns_redirects` (`zone_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_redirects_org_zone_idx` ON `windows_dns_redirects` (`organization_id`,`zone_id`);