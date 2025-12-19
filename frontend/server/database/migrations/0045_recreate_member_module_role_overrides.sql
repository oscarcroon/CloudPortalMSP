-- Re-create member_module_role_overrides table that was incorrectly dropped in 0034
-- This table is still used by the module role override system

CREATE TABLE IF NOT EXISTS `member_module_role_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `module_id` text NOT NULL,
  `role_key` text NOT NULL,
  `effect` text NOT NULL,
  `created_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `updated_by_user_id` text REFERENCES `users`(`id`) ON DELETE SET NULL,
  `created_at` integer,
  `updated_at` integer
);

CREATE UNIQUE INDEX IF NOT EXISTS `member_module_role_overrides_unique` ON `member_module_role_overrides` (`organization_id`, `user_id`, `module_id`, `role_key`);

CREATE INDEX IF NOT EXISTS `member_module_role_overrides_org_idx` ON `member_module_role_overrides` (`organization_id`, `module_id`);

