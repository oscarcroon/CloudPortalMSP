-- Legacy migration recreated to match schema snapshot 0010_abandoned_rage
-- Creates the audit_logs table and supporting indexes/foreign key if missing

CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event_type` text NOT NULL,
	`severity` text NOT NULL DEFAULT 'info',
	`request_id` text,
	`endpoint` text,
	`method` text,
	`org_id` text,
	`tenant_id` text,
	`from_context` text,
	`to_context` text,
	`ip` text,
	`user_agent` text,
	`meta` text,
	`created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	`updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_timestamp_idx` ON `audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_event_type_idx` ON `audit_logs` (`event_type`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_request_id_idx` ON `audit_logs` (`request_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_org_id_idx` ON `audit_logs` (`org_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_tenant_id_idx` ON `audit_logs` (`tenant_id`);

