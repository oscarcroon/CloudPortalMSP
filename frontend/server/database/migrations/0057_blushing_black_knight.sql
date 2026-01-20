CREATE TABLE `cloudflare_dns_org_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`encrypted_api_token` text(4096) NOT NULL,
	`encryption_iv` text NOT NULL,
	`encryption_auth_tag` text NOT NULL,
	`account_id` text,
	`last_sync_at` integer,
	`last_sync_status` text,
	`last_sync_error` text,
	`last_validated_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloudflare_dns_org_config_org_idx` ON `cloudflare_dns_org_config` (`organization_id`);--> statement-breakpoint
CREATE TABLE `cloudflare_dns_zone_acls` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cloudflare_dns_zone_acls_zone_idx` ON `cloudflare_dns_zone_acls` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `cloudflare_dns_zone_acls_principal_idx` ON `cloudflare_dns_zone_acls` (`organization_id`,`principal_type`,`principal_id`);--> statement-breakpoint
CREATE TABLE `cloudflare_dns_zones_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text,
	`plan` text,
	`record_count` integer,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloudflare_dns_zones_cache_org_zone_idx` ON `cloudflare_dns_zones_cache` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `cloudflare_dns_zones_cache_org_idx` ON `cloudflare_dns_zones_cache` (`organization_id`);--> statement-breakpoint
CREATE TABLE `module_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`module_key` text NOT NULL,
	`permission_key` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`removed_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `module_permissions_module_perm_idx` ON `module_permissions` (`module_key`,`permission_key`);--> statement-breakpoint
CREATE INDEX `module_permissions_status_idx` ON `module_permissions` (`status`);--> statement-breakpoint
CREATE INDEX `module_permissions_active_idx` ON `module_permissions` (`is_active`);--> statement-breakpoint
CREATE TABLE `module_role_defaults` (
	`id` text PRIMARY KEY NOT NULL,
	`module_key` text NOT NULL,
	`app_role_key` text NOT NULL,
	`module_role_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `module_role_defaults_idx` ON `module_role_defaults` (`module_key`,`app_role_key`);--> statement-breakpoint
CREATE TABLE `module_role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`module_key` text NOT NULL,
	`role_key` text NOT NULL,
	`permission_key` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`module_key`) REFERENCES `modules`(`key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `module_role_permissions_idx` ON `module_role_permissions` (`module_key`,`role_key`,`permission_key`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`enabled` integer DEFAULT false NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`coming_soon_message` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `modules_key_idx` ON `modules` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `modules_key_unique` ON `modules` (`key`);--> statement-breakpoint
CREATE TABLE `msp_org_delegation_permissions` (
	`delegation_id` text NOT NULL,
	`permission_key` text NOT NULL,
	PRIMARY KEY(`delegation_id`, `permission_key`),
	FOREIGN KEY (`delegation_id`) REFERENCES `msp_org_delegations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `msp_org_delegation_permissions_perm_idx` ON `msp_org_delegation_permissions` (`permission_key`);--> statement-breakpoint
CREATE TABLE `msp_org_delegations` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`source` text DEFAULT 'ad_hoc' NOT NULL,
	`supplier_tenant_id` text,
	`created_by` text,
	`expires_at` integer,
	`note` text,
	`revoked_at` integer,
	`revoked_by` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `msp_org_delegations_active_unique` ON `msp_org_delegations` (`org_id`,`subject_type`,`subject_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `msp_org_delegations_subject_idx` ON `msp_org_delegations` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `msp_org_delegations_org_idx` ON `msp_org_delegations` (`org_id`);--> statement-breakpoint
CREATE INDEX `msp_org_delegations_expires_idx` ON `msp_org_delegations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `msp_org_delegations_revoked_idx` ON `msp_org_delegations` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `msp_org_delegations_tenant_user_idx` ON `msp_org_delegations` (`supplier_tenant_id`,`subject_id`);--> statement-breakpoint
CREATE TABLE `msp_role_permissions` (
	`role_id` text NOT NULL,
	`module_key` text NOT NULL,
	`permission_key` text NOT NULL,
	PRIMARY KEY(`role_id`, `module_key`, `permission_key`),
	FOREIGN KEY (`role_id`) REFERENCES `msp_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `msp_role_permissions_role_idx` ON `msp_role_permissions` (`role_id`);--> statement-breakpoint
CREATE INDEX `msp_role_permissions_module_idx` ON `msp_role_permissions` (`module_key`);--> statement-breakpoint
CREATE TABLE `msp_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`created_by` text,
	`role_kind` text DEFAULT 'role' NOT NULL,
	`source_template_id` text,
	`published_at` integer,
	`template_version` integer DEFAULT 1 NOT NULL,
	`source_template_version` integer,
	`last_synced_at` integer,
	`permissions_fingerprint` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `msp_roles_tenant_key_unique` ON `msp_roles` (`tenant_id`,`key`);--> statement-breakpoint
CREATE INDEX `msp_roles_tenant_idx` ON `msp_roles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `msp_roles_kind_tenant_idx` ON `msp_roles` (`tenant_id`,`role_kind`);--> statement-breakpoint
CREATE INDEX `msp_roles_source_template_idx` ON `msp_roles` (`source_template_id`);--> statement-breakpoint
CREATE TABLE `org_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`prefix` text NOT NULL,
	`hash_alg` text DEFAULT 'scrypt-v1' NOT NULL,
	`hash_version` integer DEFAULT 1 NOT NULL,
	`hash_params` text(256) NOT NULL,
	`salt` text NOT NULL,
	`token_hash` text NOT NULL,
	`pepper_kid` text NOT NULL,
	`scopes` text(2048) NOT NULL,
	`resource_constraints` text(2048),
	`description` text(512),
	`created_by_user_id` text NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_api_tokens_prefix_unique` ON `org_api_tokens` (`prefix`);--> statement-breakpoint
CREATE INDEX `org_api_tokens_org_idx` ON `org_api_tokens` (`organization_id`);--> statement-breakpoint
CREATE INDEX `org_api_tokens_org_active_idx` ON `org_api_tokens` (`organization_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `org_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_group_members_unique` ON `org_group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `org_group_members_group_idx` ON `org_group_members` (`group_id`);--> statement-breakpoint
CREATE TABLE `org_group_module_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`group_id` text NOT NULL,
	`module_key` text NOT NULL,
	`permission_key` text NOT NULL,
	`effect` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_group_module_permissions_unique` ON `org_group_module_permissions` (`organization_id`,`group_id`,`module_key`,`permission_key`);--> statement-breakpoint
CREATE INDEX `org_group_module_permissions_group_idx` ON `org_group_module_permissions` (`group_id`);--> statement-breakpoint
CREATE INDEX `org_group_module_permissions_module_idx` ON `org_group_module_permissions` (`module_key`,`permission_key`);--> statement-breakpoint
CREATE TABLE `org_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_groups_org_name_unique` ON `org_groups` (`organization_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `org_groups_org_slug_unique` ON `org_groups` (`organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `org_groups_org_idx` ON `org_groups` (`organization_id`);--> statement-breakpoint
CREATE TABLE `plugin_acl_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plugin_key` text NOT NULL,
	`operation` text NOT NULL,
	`group_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `org_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plugin_acl_org_plugin_op_idx` ON `plugin_acl_entries` (`organization_id`,`plugin_key`,`operation`);--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_acl_unique` ON `plugin_acl_entries` (`organization_id`,`plugin_key`,`operation`,`group_id`);--> statement-breakpoint
CREATE TABLE `tenant_incident_mutes` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_tenant_id` text,
	`organization_id` text,
	`muted_by_user_id` text NOT NULL,
	`muted_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`mute_until` integer,
	`muted_reason` text,
	FOREIGN KEY (`incident_id`) REFERENCES `tenant_incidents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_incident_mutes_incident_idx` ON `tenant_incident_mutes` (`incident_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_incident_mutes_tenant_unique` ON `tenant_incident_mutes` (`incident_id`,`target_type`,`target_tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_incident_mutes_org_unique` ON `tenant_incident_mutes` (`incident_id`,`target_type`,`organization_id`);--> statement-breakpoint
CREATE TABLE `tenant_incident_user_mutes` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`user_id` text NOT NULL,
	`muted_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`mute_until` integer,
	FOREIGN KEY (`incident_id`) REFERENCES `tenant_incidents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_incident_user_mutes_incident_idx` ON `tenant_incident_user_mutes` (`incident_id`);--> statement-breakpoint
CREATE INDEX `tenant_incident_user_mutes_user_idx` ON `tenant_incident_user_mutes` (`user_id`,`muted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_incident_user_mutes_unique` ON `tenant_incident_user_mutes` (`incident_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `tenant_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`source_tenant_id` text,
	`source_organization_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body_markdown` text,
	`severity` text DEFAULT 'notice' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`resolved_at` integer,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`deleted_at` integer,
	`deleted_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`source_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tenant_incidents_source_tenant_idx` ON `tenant_incidents` (`source_tenant_id`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_source_org_idx` ON `tenant_incidents` (`source_organization_id`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_status_idx` ON `tenant_incidents` (`status`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_slug_tenant_idx` ON `tenant_incidents` (`source_tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_slug_org_idx` ON `tenant_incidents` (`source_organization_id`,`slug`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_active_idx` ON `tenant_incidents` (`source_tenant_id`,`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `tenant_incidents_deleted_idx` ON `tenant_incidents` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `tenant_member_msp_roles` (
	`tenant_membership_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`tenant_membership_id`, `role_id`),
	FOREIGN KEY (`tenant_membership_id`) REFERENCES `tenant_memberships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `msp_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_member_msp_roles_membership_idx` ON `tenant_member_msp_roles` (`tenant_membership_id`);--> statement-breakpoint
CREATE INDEX `tenant_member_msp_roles_role_idx` ON `tenant_member_msp_roles` (`role_id`);--> statement-breakpoint
CREATE TABLE `tenant_news_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`hero_image_url` text,
	`body_markdown` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`source_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tenant_news_posts_source_tenant_idx` ON `tenant_news_posts` (`source_tenant_id`);--> statement-breakpoint
CREATE INDEX `tenant_news_posts_status_idx` ON `tenant_news_posts` (`status`);--> statement-breakpoint
CREATE INDEX `tenant_news_posts_published_idx` ON `tenant_news_posts` (`source_tenant_id`,`status`,`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_news_posts_slug_unique` ON `tenant_news_posts` (`source_tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `windows_dns_allowed_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`zone_name` text,
	`source` text DEFAULT 'autodiscover' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_allowed_zones_org_zone_unique` ON `windows_dns_allowed_zones` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_allowed_zones_org_idx` ON `windows_dns_allowed_zones` (`organization_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_blocked_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`zone_name` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_blocked_zones_org_zone_unique` ON `windows_dns_blocked_zones` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_blocked_zones_org_idx` ON `windows_dns_blocked_zones` (`organization_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_last_discovery` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`zone_ids_json` text NOT NULL,
	`core_id_snapshot` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_last_discovery_organization_id_unique` ON `windows_dns_last_discovery` (`organization_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_last_discovery_org_idx` ON `windows_dns_last_discovery` (`organization_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_org_config` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`windows_dns_account_id` text,
	`instance_id` text,
	`enabled_at` integer,
	`last_validated_at` integer,
	`last_sync_at` integer,
	`last_sync_status` text,
	`last_sync_error` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `windows_dns_org_config_organization_id_unique` ON `windows_dns_org_config` (`organization_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_org_config_org_idx` ON `windows_dns_org_config` (`organization_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_zone_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`principal_type` text NOT NULL,
	`principal_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zone_id`) REFERENCES `windows_dns_zones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `windows_dns_zone_memberships_zone_idx` ON `windows_dns_zone_memberships` (`organization_id`,`zone_id`);--> statement-breakpoint
CREATE INDEX `windows_dns_zone_memberships_principal_idx` ON `windows_dns_zone_memberships` (`organization_id`,`principal_type`,`principal_id`);--> statement-breakpoint
CREATE TABLE `windows_dns_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `windows_dns_zones_org_idx` ON `windows_dns_zones` (`organization_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cloudflare_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`encrypted_api_token` text(2048) NOT NULL,
	`encryption_iv` text NOT NULL,
	`encryption_auth_tag` text NOT NULL,
	`account_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_validated_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cloudflare_credentials`("id", "organization_id", "encrypted_api_token", "encryption_iv", "encryption_auth_tag", "account_id", "is_active", "last_validated_at", "created_at", "updated_at") SELECT "id", "organization_id", "encrypted_api_token", "encryption_iv", "encryption_auth_tag", "account_id", "is_active", "last_validated_at", "created_at", "updated_at" FROM `cloudflare_credentials`;--> statement-breakpoint
DROP TABLE `cloudflare_credentials`;--> statement-breakpoint
ALTER TABLE `__new_cloudflare_credentials` RENAME TO `cloudflare_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cloudflare_credentials_org_unique` ON `cloudflare_credentials` (`organization_id`);--> statement-breakpoint
CREATE TABLE `__new_dns_records` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`ttl` integer DEFAULT 3600 NOT NULL,
	`proxied` integer DEFAULT false NOT NULL,
	`priority` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `dns_zones`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_dns_records`("id", "zone_id", "organization_id", "type", "name", "content", "ttl", "proxied", "priority", "created_at", "updated_at") SELECT "id", "zone_id", "organization_id", "type", "name", "content", "ttl", "proxied", "priority", "created_at", "updated_at" FROM `dns_records`;--> statement-breakpoint
DROP TABLE `dns_records`;--> statement-breakpoint
ALTER TABLE `__new_dns_records` RENAME TO `dns_records`;--> statement-breakpoint
CREATE UNIQUE INDEX `dns_records_zone_name_idx` ON `dns_records` (`zone_id`,`name`,`type`);--> statement-breakpoint
CREATE TABLE `__new_email_provider_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`tenant_id` text,
	`organization_id` text,
	`provider_type` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`from_name` text,
	`from_email` text,
	`reply_to_email` text,
	`subject_prefix` text,
	`support_contact` text,
	`email_dark_mode` integer DEFAULT false NOT NULL,
	`branding_config` text(4096),
	`encrypted_config` text(8192),
	`encryption_iv` text,
	`encryption_auth_tag` text,
	`config_version` integer DEFAULT 1 NOT NULL,
	`last_tested_at` integer,
	`last_test_status` text,
	`last_test_error` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_provider_profiles`("id", "target_type", "target_key", "tenant_id", "organization_id", "provider_type", "is_active", "from_name", "from_email", "reply_to_email", "subject_prefix", "support_contact", "email_dark_mode", "branding_config", "encrypted_config", "encryption_iv", "encryption_auth_tag", "config_version", "last_tested_at", "last_test_status", "last_test_error", "created_at", "updated_at") SELECT "id", "target_type", "target_key", "tenant_id", "organization_id", "provider_type", "is_active", "from_name", "from_email", "reply_to_email", "subject_prefix", "support_contact", "email_dark_mode", "branding_config", "encrypted_config", "encryption_iv", "encryption_auth_tag", "config_version", "last_tested_at", "last_test_status", "last_test_error", "created_at", "updated_at" FROM `email_provider_profiles`;--> statement-breakpoint
DROP TABLE `email_provider_profiles`;--> statement-breakpoint
ALTER TABLE `__new_email_provider_profiles` RENAME TO `email_provider_profiles`;--> statement-breakpoint
CREATE UNIQUE INDEX `email_provider_target_key_idx` ON `email_provider_profiles` (`target_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_provider_org_unique` ON `email_provider_profiles` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_provider_tenant_unique` ON `email_provider_profiles` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_organization_auth_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`idp_type` text DEFAULT 'none' NOT NULL,
	`sso_enforced` integer DEFAULT false NOT NULL,
	`allow_local_login_for_owners` integer DEFAULT true NOT NULL,
	`require_mfa_on_sensitive_actions` integer DEFAULT false NOT NULL,
	`require_mfa_on_context_switch` integer DEFAULT false NOT NULL,
	`idp_config` text(4096),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organization_auth_settings`("organization_id", "idp_type", "sso_enforced", "allow_local_login_for_owners", "require_mfa_on_sensitive_actions", "require_mfa_on_context_switch", "idp_config", "created_at", "updated_at") SELECT "organization_id", "idp_type", "sso_enforced", "allow_local_login_for_owners", "require_mfa_on_sensitive_actions", "require_mfa_on_context_switch", "idp_config", "created_at", "updated_at" FROM `organization_auth_settings`;--> statement-breakpoint
DROP TABLE `organization_auth_settings`;--> statement-breakpoint
ALTER TABLE `__new_organization_auth_settings` RENAME TO `organization_auth_settings`;--> statement-breakpoint
CREATE TABLE `__new_organization_identity_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text DEFAULT 'oidc' NOT NULL,
	`provider_name` text NOT NULL,
	`issuer` text,
	`client_id` text,
	`client_secret` text,
	`redirect_uri` text,
	`metadata_url` text,
	`audience` text,
	`scopes` text,
	`is_enabled` integer DEFAULT false NOT NULL,
	`enforce_for_user_type` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organization_identity_providers`("id", "organization_id", "type", "provider_name", "issuer", "client_id", "client_secret", "redirect_uri", "metadata_url", "audience", "scopes", "is_enabled", "enforce_for_user_type", "created_at", "updated_at") SELECT "id", "organization_id", "type", "provider_name", "issuer", "client_id", "client_secret", "redirect_uri", "metadata_url", "audience", "scopes", "is_enabled", "enforce_for_user_type", "created_at", "updated_at" FROM `organization_identity_providers`;--> statement-breakpoint
DROP TABLE `organization_identity_providers`;--> statement-breakpoint
ALTER TABLE `__new_organization_identity_providers` RENAME TO `organization_identity_providers`;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_idp_unique` ON `organization_identity_providers` (`organization_id`,`provider_name`);--> statement-breakpoint
CREATE TABLE `__new_organization_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`mode` text DEFAULT 'inherit' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`coming_soon_message` text,
	`permission_overrides` text(2048),
	`allowed_roles` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organization_module_policies`("id", "organization_id", "module_id", "mode", "enabled", "disabled", "coming_soon_message", "permission_overrides", "allowed_roles", "created_at", "updated_at") SELECT "id", "organization_id", "module_id", "mode", "enabled", "disabled", "coming_soon_message", "permission_overrides", "allowed_roles", "created_at", "updated_at" FROM `organization_module_policies`;--> statement-breakpoint
DROP TABLE `organization_module_policies`;--> statement-breakpoint
ALTER TABLE `__new_organization_module_policies` RENAME TO `organization_module_policies`;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_module_policy_unique` ON `organization_module_policies` (`organization_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `organization_module_policy_org_idx` ON `organization_module_policies` (`organization_id`);--> statement-breakpoint
CREATE TABLE `__new_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`tenant_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`is_suspended` integer DEFAULT false NOT NULL,
	`default_role` text DEFAULT 'viewer' NOT NULL,
	`require_sso` integer DEFAULT false NOT NULL,
	`allow_self_signup` integer DEFAULT false NOT NULL,
	`logo_url` text,
	`billing_email` text,
	`core_id` text,
	`email_disclaimer_markdown` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_organizations`("id", "name", "slug", "tenant_id", "status", "is_suspended", "default_role", "require_sso", "allow_self_signup", "logo_url", "billing_email", "core_id", "email_disclaimer_markdown", "created_at", "updated_at") SELECT "id", "name", "slug", "tenant_id", "status", "is_suspended", "default_role", "require_sso", "allow_self_signup", "logo_url", "billing_email", "core_id", "email_disclaimer_markdown", "created_at", "updated_at" FROM `organizations`;--> statement-breakpoint
DROP TABLE `organizations`;--> statement-breakpoint
ALTER TABLE `__new_organizations` RENAME TO `organizations`;--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_idx` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_tenant_auth_settings` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`require_mfa_on_sensitive_actions` integer DEFAULT false NOT NULL,
	`require_mfa_on_context_switch` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tenant_auth_settings`("tenant_id", "require_mfa_on_sensitive_actions", "require_mfa_on_context_switch", "created_at", "updated_at") SELECT "tenant_id", "require_mfa_on_sensitive_actions", "require_mfa_on_context_switch", "created_at", "updated_at" FROM `tenant_auth_settings`;--> statement-breakpoint
DROP TABLE `tenant_auth_settings`;--> statement-breakpoint
ALTER TABLE `__new_tenant_auth_settings` RENAME TO `tenant_auth_settings`;--> statement-breakpoint
CREATE TABLE `__new_tenant_module_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`module_id` text NOT NULL,
	`mode` text DEFAULT 'inherit' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`disabled` integer DEFAULT false NOT NULL,
	`coming_soon_message` text,
	`permission_overrides` text(2048),
	`allowed_roles` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tenant_module_policies`("id", "tenant_id", "module_id", "mode", "enabled", "disabled", "coming_soon_message", "permission_overrides", "allowed_roles", "created_at", "updated_at") SELECT "id", "tenant_id", "module_id", "mode", "enabled", "disabled", "coming_soon_message", "permission_overrides", "allowed_roles", "created_at", "updated_at" FROM `tenant_module_policies`;--> statement-breakpoint
DROP TABLE `tenant_module_policies`;--> statement-breakpoint
ALTER TABLE `__new_tenant_module_policies` RENAME TO `tenant_module_policies`;--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_module_policy_unique` ON `tenant_module_policies` (`tenant_id`,`module_id`);--> statement-breakpoint
CREATE INDEX `tenant_module_policy_tenant_idx` ON `tenant_module_policies` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`full_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`locale` text DEFAULT 'sv' NOT NULL,
	`is_super_admin` integer DEFAULT false NOT NULL,
	`is_mfa_enabled` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`default_org_id` text,
	`enforced_org_id` text,
	`force_password_reset` integer DEFAULT false NOT NULL,
	`password_reset_token_hash` text,
	`password_reset_expires_at` integer,
	`metadata` text(2048),
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "full_name", "status", "locale", "is_super_admin", "is_mfa_enabled", "last_login_at", "default_org_id", "enforced_org_id", "force_password_reset", "password_reset_token_hash", "password_reset_expires_at", "metadata", "created_at", "updated_at", "deleted_at") SELECT "id", "email", "password_hash", "full_name", "status", "locale", "is_super_admin", "is_mfa_enabled", "last_login_at", "default_org_id", "enforced_org_id", "force_password_reset", "password_reset_token_hash", "password_reset_expires_at", "metadata", "created_at", "updated_at", "deleted_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `module_roles` ADD `sort_order` integer DEFAULT 0 NOT NULL;