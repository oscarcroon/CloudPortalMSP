ALTER TABLE `users` ADD COLUMN `is_super_admin` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizations` ADD COLUMN `self_signup_enabled` integer DEFAULT 0 NOT NULL;

