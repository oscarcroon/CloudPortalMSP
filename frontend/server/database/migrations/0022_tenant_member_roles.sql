CREATE TABLE `tenant_member_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`membership_id` text NOT NULL,
	`role_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_member_roles_membership_role_unique` ON `tenant_member_roles` (`membership_id`,`role_key`);
--> statement-breakpoint
CREATE INDEX `tenant_member_roles_membership_idx` ON `tenant_member_roles` (`membership_id`);

