ALTER TABLE `organizations` RENAME COLUMN `enforce_sso` TO `require_sso`;
--> statement-breakpoint
ALTER TABLE `organizations` RENAME COLUMN `self_signup_enabled` TO `allow_self_signup`;
--> statement-breakpoint
ALTER TABLE `organization_memberships` ADD COLUMN `status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE TABLE `organization_auth_settings` (
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
INSERT INTO `organization_auth_settings` (
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
FROM `organizations`;

