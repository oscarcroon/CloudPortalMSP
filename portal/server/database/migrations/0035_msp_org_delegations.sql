-- MSP → Org delegation tables

CREATE TABLE IF NOT EXISTS `msp_org_delegations` (
  `id` text PRIMARY KEY NOT NULL,
  `org_id` text NOT NULL,
  `subject_type` text NOT NULL, -- 'user' (future: msp_group, msp_role)
  `subject_id` text NOT NULL,
  `created_by` text,
  `expires_at` integer,
  `note` text,
  `revoked_at` integer,
  `revoked_by` text,
  `created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE IF NOT EXISTS `msp_org_delegation_permissions` (
  `delegation_id` text NOT NULL,
  `permission_key` text NOT NULL,
  PRIMARY KEY (`delegation_id`, `permission_key`),
  FOREIGN KEY (`delegation_id`) REFERENCES `msp_org_delegations`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `msp_org_delegations_active_unique` ON `msp_org_delegations` (`org_id`, `subject_type`, `subject_id`, COALESCE(`revoked_at`, 0), COALESCE(`expires_at`, 0));
CREATE INDEX IF NOT EXISTS `msp_org_delegations_subject_idx` ON `msp_org_delegations` (`subject_type`, `subject_id`);
CREATE INDEX IF NOT EXISTS `msp_org_delegations_org_idx` ON `msp_org_delegations` (`org_id`);
CREATE INDEX IF NOT EXISTS `msp_org_delegations_expires_idx` ON `msp_org_delegations` (`expires_at`);
CREATE INDEX IF NOT EXISTS `msp_org_delegations_revoked_idx` ON `msp_org_delegations` (`revoked_at`);

CREATE INDEX IF NOT EXISTS `msp_org_delegation_permissions_perm_idx` ON `msp_org_delegation_permissions` (`permission_key`);


