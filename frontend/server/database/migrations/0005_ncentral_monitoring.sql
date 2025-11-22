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
--> statement-breakpoint
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


