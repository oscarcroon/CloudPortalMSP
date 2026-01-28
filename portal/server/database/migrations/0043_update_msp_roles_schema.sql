-- Update msp_roles table to add is_system and created_by fields
-- Add tenant_member_msp_roles join table

-- Add new columns to msp_roles
ALTER TABLE `msp_roles` ADD COLUMN `is_system` integer NOT NULL DEFAULT 0;
ALTER TABLE `msp_roles` ADD COLUMN `created_by` text REFERENCES `users`(`id`) ON DELETE SET NULL;

-- Create tenant_member_msp_roles join table
CREATE TABLE IF NOT EXISTS `tenant_member_msp_roles` (
  `tenant_membership_id` text NOT NULL REFERENCES `tenant_memberships`(`id`) ON DELETE CASCADE,
  `role_id` text NOT NULL REFERENCES `msp_roles`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`tenant_membership_id`, `role_id`)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS `tenant_member_msp_roles_membership_idx` ON `tenant_member_msp_roles` (`tenant_membership_id`);
CREATE INDEX IF NOT EXISTS `tenant_member_msp_roles_role_idx` ON `tenant_member_msp_roles` (`role_id`);
