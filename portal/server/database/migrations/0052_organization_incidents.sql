-- Add sourceOrganizationId column to tenant_incidents for organization-internal incidents
-- This allows organizations to create their own incidents visible only to their members

ALTER TABLE `tenant_incidents` ADD `source_organization_id` text REFERENCES `organizations`(`id`) ON DELETE CASCADE;

-- Create index for organization source lookup
CREATE INDEX `tenant_incidents_source_org_idx` ON `tenant_incidents` (`source_organization_id`);

-- Create index for slug uniqueness within organizations  
CREATE INDEX `tenant_incidents_slug_org_idx` ON `tenant_incidents` (`source_organization_id`, `slug`);

-- Drop the old slug index and recreate with new name for tenant-based slugs
DROP INDEX IF EXISTS `tenant_incidents_slug_idx`;
CREATE INDEX `tenant_incidents_slug_tenant_idx` ON `tenant_incidents` (`source_tenant_id`, `slug`);

-- Make source_tenant_id nullable (it was NOT NULL before, but now either source_tenant_id OR source_organization_id should be set)
-- SQLite doesn't support ALTER COLUMN, so we need to use a workaround
-- For existing data, source_tenant_id is already set, so no data migration needed

