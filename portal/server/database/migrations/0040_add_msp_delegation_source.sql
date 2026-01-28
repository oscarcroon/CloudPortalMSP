-- Add source and supplier_tenant_id to msp_org_delegations for LIST-scope support
-- source: 'ad_hoc' (existing delegations) or 'msp_scope' (LIST-scope from tenant member)
-- supplier_tenant_id: links delegation to tenant context for LIST-scope

-- Add new columns
ALTER TABLE `msp_org_delegations` ADD COLUMN `source` text DEFAULT 'ad_hoc';
ALTER TABLE `msp_org_delegations` ADD COLUMN `supplier_tenant_id` text;

-- Update existing delegations to have source='ad_hoc' explicitly
UPDATE `msp_org_delegations` SET `source` = 'ad_hoc' WHERE `source` IS NULL;

-- Create index for LIST-scope lookups (SQLite doesn't support partial indexes with WHERE, so we create a regular index)
CREATE INDEX IF NOT EXISTS `msp_org_delegations_tenant_user_idx` ON `msp_org_delegations` (`supplier_tenant_id`, `subject_id`);
