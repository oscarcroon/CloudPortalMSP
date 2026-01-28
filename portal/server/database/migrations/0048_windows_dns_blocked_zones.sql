-- Windows DNS blocked zones (blocklist per org)
-- Zones that have been explicitly hidden by admin and should not be auto-activated.
CREATE TABLE IF NOT EXISTS `windows_dns_blocked_zones` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `zone_id` text NOT NULL,
  `zone_name` text,
  `source` text NOT NULL DEFAULT 'manual',
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `windows_dns_blocked_zones_org_zone_unique` ON `windows_dns_blocked_zones` (`organization_id`, `zone_id`);
CREATE INDEX IF NOT EXISTS `windows_dns_blocked_zones_org_idx` ON `windows_dns_blocked_zones` (`organization_id`);

