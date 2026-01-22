-- Migration: Organization API Tokens (PAT)
-- Adds table for storing hashed API tokens for programmatic access

CREATE TABLE IF NOT EXISTS `org_api_tokens` (
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

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS `org_api_tokens_prefix_unique` ON `org_api_tokens` (`prefix`);
CREATE INDEX IF NOT EXISTS `org_api_tokens_org_idx` ON `org_api_tokens` (`organization_id`);
CREATE INDEX IF NOT EXISTS `org_api_tokens_org_active_idx` ON `org_api_tokens` (`organization_id`, `revoked_at`);

