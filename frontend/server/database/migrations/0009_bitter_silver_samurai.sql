CREATE TABLE `distributor_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`distributor_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`distributor_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `distributor_provider_unique` ON `distributor_providers` (`distributor_id`,`provider_id`);