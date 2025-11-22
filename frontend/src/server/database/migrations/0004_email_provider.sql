CREATE TABLE `email_provider_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `target_type` text NOT NULL,
  `target_key` text NOT NULL UNIQUE,
  `organization_id` text UNIQUE,
  `provider_type` text NOT NULL,
  `is_active` integer DEFAULT 0 NOT NULL,
  `from_name` text,
  `from_email` text,
  `reply_to_email` text,
  `branding_config` text,
  `encrypted_config` text,
  `encryption_iv` text,
  `encryption_auth_tag` text,
  `config_version` integer DEFAULT 1 NOT NULL,
  `last_tested_at` integer,
  `last_test_status` text,
  `last_test_error` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);

