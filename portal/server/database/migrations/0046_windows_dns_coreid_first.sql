-- Windows DNS org configuration (one per org)
-- Stores the WindowsDNS account binding, NOT the CoreID (derived from organizations.core_id)
CREATE TABLE IF NOT EXISTS `windows_dns_org_config` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL UNIQUE,
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
CREATE INDEX IF NOT EXISTS `windows_dns_org_config_org_idx` ON `windows_dns_org_config` (`organization_id`);

-- Windows DNS allowed zones (allowlist per org)
-- These are the external zone IDs from the WindowsDNS layer that this org is allowed to access
CREATE TABLE IF NOT EXISTS `windows_dns_allowed_zones` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `zone_id` text NOT NULL,
  `zone_name` text,
  `source` text NOT NULL DEFAULT 'autodiscover',
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `windows_dns_allowed_zones_org_zone_unique` ON `windows_dns_allowed_zones` (`organization_id`, `zone_id`);
CREATE INDEX IF NOT EXISTS `windows_dns_allowed_zones_org_idx` ON `windows_dns_allowed_zones` (`organization_id`);

-- Windows DNS last discovery result (for validating activate requests)
CREATE TABLE IF NOT EXISTS `windows_dns_last_discovery` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL UNIQUE,
  `discovered_at` integer NOT NULL,
  `zone_ids_json` text NOT NULL,
  `core_id_snapshot` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `windows_dns_last_discovery_org_idx` ON `windows_dns_last_discovery` (`organization_id`);


