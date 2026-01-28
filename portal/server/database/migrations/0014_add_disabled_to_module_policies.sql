-- Migration to add disabled field to module policies
-- This allows modules to be visible but grayed out (deactivated) vs completely hidden (inactivated)

-- Add disabled column to tenant_module_policies
ALTER TABLE `tenant_module_policies` ADD COLUMN `disabled` integer DEFAULT 0 NOT NULL;

-- Add disabled column to organization_module_policies
ALTER TABLE `organization_module_policies` ADD COLUMN `disabled` integer DEFAULT 0 NOT NULL;

