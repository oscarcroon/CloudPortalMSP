-- Add comingSoonMessage field to tenant and organization module policies
-- This allows modules to show a "coming soon" message for marketing/upselling

ALTER TABLE `tenant_module_policies` ADD COLUMN `coming_soon_message` text;

ALTER TABLE `organization_module_policies` ADD COLUMN `coming_soon_message` text;


