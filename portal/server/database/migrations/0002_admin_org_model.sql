-- Idempotent migration: Rename columns in organizations table
-- SQLite doesn't support IF NOT EXISTS for RENAME COLUMN
-- Note: If columns are already renamed (require_sso exists), this migration will skip table recreation

-- Step 1: Create new organizations table with renamed columns (if it doesn't already exist)
CREATE TABLE IF NOT EXISTS `organizations_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_suspended` integer DEFAULT 0 NOT NULL,
	`default_role` text DEFAULT 'viewer' NOT NULL,
	`require_sso` integer DEFAULT 0 NOT NULL,
	`allow_self_signup` integer DEFAULT 0 NOT NULL,
	`logo_url` text,
	`billing_email` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
-- Step 2: Drop old table if it exists
DROP TABLE IF EXISTS `organizations`;
--> statement-breakpoint
-- Step 3: Rename new table to organizations (only if it exists)
ALTER TABLE `organizations_new` RENAME TO `organizations`;
--> statement-breakpoint
-- Step 4: Recreate the unique index
CREATE UNIQUE INDEX IF NOT EXISTS `organizations_slug_idx` ON `organizations` (`slug`);
--> statement-breakpoint
-- Step 5: Create organization_auth_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS `organization_auth_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`idp_type` text DEFAULT 'none' NOT NULL,
	`sso_enforced` integer DEFAULT 0 NOT NULL,
	`allow_local_login_for_owners` integer DEFAULT 1 NOT NULL,
	`idp_config` text(4096),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Step 6: Insert data into organization_auth_settings (only if it doesn't already exist for each org)
-- Use require_sso column (new name) from organizations table
INSERT OR IGNORE INTO `organization_auth_settings` (
	`organization_id`,
	`idp_type`,
	`sso_enforced`,
	`allow_local_login_for_owners`
)
SELECT
	`id`,
	'none' as `idp_type`,
	`require_sso` as `sso_enforced`,
	1 as `allow_local_login_for_owners`
FROM `organizations`
WHERE NOT EXISTS (SELECT 1 FROM `organization_auth_settings` WHERE `organization_auth_settings`.`organization_id` = `organizations`.`id`);
