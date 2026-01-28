-- Migration: 0049_tenant_operations
-- Description: Add tables for tenant incidents (driftmeddelanden) and news posts

-- Tenant Incidents (Driftmeddelanden)
-- Created by distributors/providers, inherited downstream.
CREATE TABLE IF NOT EXISTS `tenant_incidents` (
  `id` text PRIMARY KEY NOT NULL,
  `source_tenant_id` text NOT NULL REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `body_markdown` text,
  `severity` text NOT NULL DEFAULT 'notice',
  `status` text NOT NULL DEFAULT 'active',
  `starts_at` integer,
  `ends_at` integer,
  `resolved_at` integer,
  `created_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `updated_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `deleted_at` integer,
  `deleted_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS `tenant_incidents_source_tenant_idx` ON `tenant_incidents`(`source_tenant_id`);
CREATE INDEX IF NOT EXISTS `tenant_incidents_status_idx` ON `tenant_incidents`(`status`);
CREATE INDEX IF NOT EXISTS `tenant_incidents_active_idx` ON `tenant_incidents`(`source_tenant_id`, `status`, `starts_at`, `ends_at`);
CREATE INDEX IF NOT EXISTS `tenant_incidents_deleted_idx` ON `tenant_incidents`(`deleted_at`);

-- Tenant Incident Mutes
-- Allows downstream tenants/organizations to hide inherited incidents.
CREATE TABLE IF NOT EXISTS `tenant_incident_mutes` (
  `id` text PRIMARY KEY NOT NULL,
  `incident_id` text NOT NULL REFERENCES `tenant_incidents`(`id`) ON DELETE CASCADE,
  `target_type` text NOT NULL,
  `target_tenant_id` text REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  `organization_id` text REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  `muted_by_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `muted_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `mute_until` integer
);

CREATE INDEX IF NOT EXISTS `tenant_incident_mutes_incident_idx` ON `tenant_incident_mutes`(`incident_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `tenant_incident_mutes_tenant_unique` ON `tenant_incident_mutes`(`incident_id`, `target_type`, `target_tenant_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `tenant_incident_mutes_org_unique` ON `tenant_incident_mutes`(`incident_id`, `target_type`, `organization_id`);

-- Tenant News Posts (Nyheter)
-- Blog-style posts created by distributors/providers, inherited downstream.
CREATE TABLE IF NOT EXISTS `tenant_news_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `source_tenant_id` text NOT NULL REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `slug` text NOT NULL,
  `summary` text,
  `hero_image_url` text,
  `body_markdown` text,
  `status` text NOT NULL DEFAULT 'draft',
  `published_at` integer,
  `created_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `updated_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000),
  `updated_at` integer NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS `tenant_news_posts_source_tenant_idx` ON `tenant_news_posts`(`source_tenant_id`);
CREATE INDEX IF NOT EXISTS `tenant_news_posts_status_idx` ON `tenant_news_posts`(`status`);
CREATE INDEX IF NOT EXISTS `tenant_news_posts_published_idx` ON `tenant_news_posts`(`source_tenant_id`, `status`, `published_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `tenant_news_posts_slug_unique` ON `tenant_news_posts`(`source_tenant_id`, `slug`);

