-- Migration: Add MFA columns, mfa_sessions table, and require_mfa to org auth settings
-- Date: 2026-02-10
-- Description: Add mfa_totp_secret and mfa_backup_codes to users, create mfa_sessions table,
--              add require_mfa to organization_auth_settings

ALTER TABLE `users`
  ADD COLUMN `mfa_totp_secret` varchar(512) NULL AFTER `is_mfa_enabled`,
  ADD COLUMN `mfa_backup_codes` text NULL AFTER `mfa_totp_secret`;

ALTER TABLE `organization_auth_settings`
  ADD COLUMN `require_mfa` boolean NOT NULL DEFAULT false AFTER `require_mfa_on_context_switch`;

CREATE TABLE IF NOT EXISTS `mfa_sessions` (
  `id` varchar(128) NOT NULL,
  `user_id` varchar(128) NOT NULL,
  `scope` varchar(255) NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `mfa_sessions_user_scope_idx` (`user_id`, `scope`),
  CONSTRAINT `mfa_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
