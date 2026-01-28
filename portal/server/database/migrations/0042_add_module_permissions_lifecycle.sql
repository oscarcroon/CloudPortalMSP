-- Add lifecycle fields to module_permissions for tracking removed/deprecated permissions
-- This enables FK integrity while allowing permissions to be marked as removed instead of deleted

-- Add new columns
ALTER TABLE `module_permissions` ADD COLUMN `is_active` integer NOT NULL DEFAULT 1;
ALTER TABLE `module_permissions` ADD COLUMN `status` text NOT NULL DEFAULT 'active';
ALTER TABLE `module_permissions` ADD COLUMN `removed_at` integer;

-- Update existing rows to be active
UPDATE `module_permissions` SET `is_active` = 1, `status` = 'active' WHERE `is_active` IS NULL OR `status` IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS `module_permissions_status_idx` ON `module_permissions` (`status`);
CREATE INDEX IF NOT EXISTS `module_permissions_active_idx` ON `module_permissions` (`is_active`);
