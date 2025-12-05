CREATE TABLE `branding_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`tenant_id` text,
	`organization_id` text,
	`logo_url` text,
	`accent_color` text(16),
	`palette_key` text(64),
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branding_theme_tenant_unique` ON `branding_themes` (`target_type`,`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `branding_theme_org_unique` ON `branding_themes` (`organization_id`);--> statement-breakpoint
INSERT INTO `branding_themes` (
	`id`,
	`target_type`,
	`organization_id`,
	`logo_url`,
	`created_at`,
	`updated_at`
)
SELECT
	LOWER(HEX(RANDOMBLOB(16))) AS `id`,
	'organization' AS `target_type`,
	`organizations`.`id` AS `organization_id`,
	`organizations`.`logo_url` AS `logo_url`,
	COALESCE(
		`organizations`.`updated_at`,
		`organizations`.`created_at`,
		(strftime('%s','now') * 1000)
	) AS `created_at`,
	COALESCE(
		`organizations`.`updated_at`,
		`organizations`.`created_at`,
		(strftime('%s','now') * 1000)
	) AS `updated_at`
FROM `organizations`
WHERE `organizations`.`logo_url` IS NOT NULL
	AND TRIM(`organizations`.`logo_url`) <> '';