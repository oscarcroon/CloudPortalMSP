CREATE TABLE `tenant_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`declined_at` integer,
	`organization_data` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invites_token_idx` ON `tenant_invitations` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invites_tenant_email_status_idx` ON `tenant_invitations` (`tenant_id`,`email`,`status`);