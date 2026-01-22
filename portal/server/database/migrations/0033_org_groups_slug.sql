-- Add slug to org_groups for unique per-organization grouping
ALTER TABLE `org_groups` ADD COLUMN `slug` text;

UPDATE `org_groups`
SET `slug` = lower(replace(name, ' ', '-'))
WHERE `slug` IS NULL OR `slug` = '';

CREATE UNIQUE INDEX IF NOT EXISTS `org_groups_org_slug_unique`
  ON `org_groups` (`organization_id`, `slug`);

-- Ensure org_group_members has group_id column
ALTER TABLE `org_group_members` ADD COLUMN `group_id` text;

CREATE INDEX IF NOT EXISTS `org_group_members_group_idx`
  ON `org_group_members` (`group_id`);

CREATE UNIQUE INDEX IF NOT EXISTS `org_group_members_unique`
  ON `org_group_members` (`group_id`, `user_id`);


