-- Add enabled column to modules table
ALTER TABLE `modules` ADD COLUMN `enabled` integer DEFAULT 0 NOT NULL;

-- Set existing modules as enabled by default
UPDATE `modules` SET `enabled` = 1 WHERE `enabled` = 0;

