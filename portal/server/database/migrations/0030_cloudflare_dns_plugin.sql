-- Cloudflare DNS plugin tables
CREATE TABLE IF NOT EXISTS `cloudflare_dns_org_config` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `encrypted_api_token` text NOT NULL,
  `encryption_iv` text NOT NULL,
  `encryption_auth_tag` text NOT NULL,
  `account_id` text,
  `last_sync_at` integer,
  `last_sync_status` text,
  `last_sync_error` text,
  `last_validated_at` integer,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `cloudflare_dns_org_config_org_idx`
  ON `cloudflare_dns_org_config` (`organization_id`);

CREATE TABLE IF NOT EXISTS `cloudflare_dns_zones_cache` (
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
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `cloudflare_dns_zones_cache_org_zone_idx`
  ON `cloudflare_dns_zones_cache` (`organization_id`, `zone_id`);
CREATE INDEX IF NOT EXISTS `cloudflare_dns_zones_cache_org_idx`
  ON `cloudflare_dns_zones_cache` (`organization_id`);

CREATE TABLE IF NOT EXISTS `cloudflare_dns_zone_acls` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `zone_id` text NOT NULL,
  `principal_type` text NOT NULL,
  `principal_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `cloudflare_dns_zone_acls_zone_idx`
  ON `cloudflare_dns_zone_acls` (`organization_id`, `zone_id`);
CREATE INDEX IF NOT EXISTS `cloudflare_dns_zone_acls_principal_idx`
  ON `cloudflare_dns_zone_acls` (`organization_id`, `principal_type`, `principal_id`);


