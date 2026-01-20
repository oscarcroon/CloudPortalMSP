ALTER TABLE `windows_dns_redirects` ADD `host` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `windows_dns_redirects_org_zone_host_idx` ON `windows_dns_redirects` (`organization_id`,`zone_id`,`host`);--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_redirects_unique_host_path` ON `windows_dns_redirects` (`organization_id`,`zone_id`,`host`,`source_path`);--> statement-breakpoint
CREATE TABLE `windows_dns_managed_records` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`record_key` text NOT NULL,
	`managed_by` text NOT NULL,
	`managed_id` text,
	`last_applied_by_user_id` text,
	`last_applied_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `windows_dns_managed_records_zone_id_idx` ON `windows_dns_managed_records` (`zone_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_managed_records_managed_id_idx` ON `windows_dns_managed_records` (`managed_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_managed_records_zone_manager_idx` ON `windows_dns_managed_records` (`zone_id`,`managed_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_managed_records_unique` ON `windows_dns_managed_records` (`zone_id`,`record_key`,`managed_by`);