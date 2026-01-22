-- Fix foreign key constraint mismatch in msp_org_delegation_permissions
-- The permission_key column should NOT have a foreign key to module_permissions
-- since it's a logical reference to manifest permission keys, not a DB reference

-- SQLite doesn't support DROP CONSTRAINT directly, so we need to recreate the table
CREATE TABLE IF NOT EXISTS `msp_org_delegation_permissions_new` (
  `delegation_id` text NOT NULL,
  `permission_key` text NOT NULL,
  PRIMARY KEY (`delegation_id`, `permission_key`),
  FOREIGN KEY (`delegation_id`) REFERENCES `msp_org_delegations`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Copy existing data
INSERT INTO `msp_org_delegation_permissions_new` (`delegation_id`, `permission_key`)
SELECT `delegation_id`, `permission_key` FROM `msp_org_delegation_permissions`;

-- Drop old table
DROP TABLE IF EXISTS `msp_org_delegation_permissions`;

-- Rename new table
ALTER TABLE `msp_org_delegation_permissions_new` RENAME TO `msp_org_delegation_permissions`;

-- Recreate index
CREATE INDEX IF NOT EXISTS `msp_org_delegation_permissions_perm_idx` ON `msp_org_delegation_permissions` (`permission_key`);


