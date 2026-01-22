CREATE TABLE `cloudflare_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`encrypted_api_token` text(2048) NOT NULL,
	`encryption_iv` text NOT NULL,
	`encryption_auth_tag` text NOT NULL,
	`account_id` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_validated_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloudflare_credentials_org_unique` ON `cloudflare_credentials` (`organization_id`);--> statement-breakpoint
CREATE TABLE `organization_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`permission_overrides` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_module_policy_unique` ON `organization_module_policies` (`organization_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `organization_module_policy_org_idx` ON `organization_module_policies` (`organization_id`);--> statement-breakpoint
CREATE TABLE `tenant_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`module_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`permission_overrides` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_module_policy_unique` ON `tenant_module_policies` (`tenant_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `tenant_module_policy_tenant_idx` ON `tenant_module_policies` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `user_module_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`denied_permissions` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_module_permission_unique` ON `user_module_permissions` (`organization_id`,`user_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `user_module_permission_user_org_idx` ON `user_module_permissions` (`organization_id`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event_type` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`request_id` text,
	`endpoint` text,
	`method` text,
	`org_id` text,
	`tenant_id` text,
	`from_context` text(1024),
	`to_context` text(1024),
	`ip` text,
	`user_agent` text(512),
	`meta` text(4096),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Copy existing data, handling missing columns gracefully
INSERT INTO `__new_audit_logs`("id", "user_id", "event_type", "severity", "request_id", "endpoint", "method", "org_id", "tenant_id", "from_context", "to_context", "ip", "user_agent", "meta", "created_at", "updated_at") 
SELECT 
  "id", 
  "user_id", 
  "event_type", 
  COALESCE("severity", 'info') as "severity",
  "request_id",
  "endpoint",
  "method",
  "org_id",
  "tenant_id",
  "from_context", 
  "to_context", 
  "ip", 
  "user_agent", 
  "meta", 
  "created_at", 
  "updated_at" 
FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_timestamp_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_event_type_idx` ON `audit_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_request_id_idx` ON `audit_logs` (`request_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_org_id_idx` ON `audit_logs` (`org_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_id_idx` ON `audit_logs` (`tenant_id`);