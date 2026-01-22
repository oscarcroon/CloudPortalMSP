-- Migration for Module Policies and Cloudflare Credentials
-- This migration adds tables for managing module policies at tenant and organization levels,
-- and stores Cloudflare API credentials per organization

-- Create tenant_module_policies table
CREATE TABLE IF NOT EXISTS `tenant_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`module_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`permission_overrides` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index for tenant + module combination
CREATE UNIQUE INDEX IF NOT EXISTS `tenant_module_policy_unique` ON `tenant_module_policies` (`tenant_id`,`module_id`);
CREATE INDEX IF NOT EXISTS `tenant_module_policy_tenant_idx` ON `tenant_module_policies` (`tenant_id`);

-- Create organization_module_policies table
CREATE TABLE IF NOT EXISTS `organization_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`permission_overrides` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Create unique index for organization + module combination
CREATE UNIQUE INDEX IF NOT EXISTS `organization_module_policy_unique` ON `organization_module_policies` (`organization_id`,`module_id`);
CREATE INDEX IF NOT EXISTS `organization_module_policy_org_idx` ON `organization_module_policies` (`organization_id`);

-- Create cloudflare_credentials table
CREATE TABLE IF NOT EXISTS `cloudflare_credentials` (
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

-- Create unique index for organization (one credential set per organization)
CREATE UNIQUE INDEX IF NOT EXISTS `cloudflare_credentials_org_unique` ON `cloudflare_credentials` (`organization_id`);

