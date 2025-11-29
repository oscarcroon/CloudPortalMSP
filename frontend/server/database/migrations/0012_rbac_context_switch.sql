-- Migration for RBAC Context Switching & MFA
-- This migration adds the new tables and columns needed for context switching and MFA

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_context` text(1024),
	`to_context` text(1024),
	`ip` text,
	`user_agent` text(512),
	`meta` text(4096),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create indexes for audit_logs (only if table exists)
CREATE INDEX IF NOT EXISTS `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);
CREATE INDEX IF NOT EXISTS `audit_logs_event_type_idx` ON `audit_logs` (`event_type`);
CREATE INDEX IF NOT EXISTS `audit_logs_timestamp_idx` ON `audit_logs` (`created_at`);

-- Create mfa_sessions table
CREATE TABLE IF NOT EXISTS `mfa_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `mfa_sessions_user_scope_idx` ON `mfa_sessions` (`user_id`,`scope`);

-- Create tenant_auth_settings table
CREATE TABLE IF NOT EXISTS `tenant_auth_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`require_mfa_on_sensitive_actions` integer DEFAULT 0 NOT NULL,
	`require_mfa_on_context_switch` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Add MFA columns to organization_auth_settings (with default values to preserve existing data)
ALTER TABLE `organization_auth_settings` ADD COLUMN `require_mfa_on_sensitive_actions` integer DEFAULT 0 NOT NULL;
ALTER TABLE `organization_auth_settings` ADD COLUMN `require_mfa_on_context_switch` integer DEFAULT 0 NOT NULL;

