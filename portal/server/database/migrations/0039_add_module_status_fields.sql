-- Add disabled and comingSoonMessage fields to modules table (global level)
ALTER TABLE `modules` ADD COLUMN `disabled` integer DEFAULT 0 NOT NULL;
ALTER TABLE `modules` ADD COLUMN `coming_soon_message` text;


