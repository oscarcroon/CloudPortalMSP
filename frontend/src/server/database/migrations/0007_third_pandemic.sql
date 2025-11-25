PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenant_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`include_children` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tenant_memberships`("id", "tenant_id", "user_id", "role", "include_children", "status", "created_at", "updated_at") 
SELECT 
  "id", 
  "tenant_id", 
  "user_id", 
  CASE 
    WHEN "role" IN ('supplier-admin', 'distributor-admin') THEN 'admin'
    ELSE 'viewer'
  END as "role",
  CASE 
    WHEN "role" IN ('supplier-admin', 'distributor-admin') THEN 1
    ELSE 0
  END as "include_children",
  "status", 
  "created_at", 
  "updated_at" 
FROM `tenant_memberships`;--> statement-breakpoint
DROP TABLE `tenant_memberships`;--> statement-breakpoint
ALTER TABLE `__new_tenant_memberships` RENAME TO `tenant_memberships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_membership_unique` ON `tenant_memberships` (`tenant_id`,`user_id`);