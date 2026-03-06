-- Migration: Add organization_sso_domains table
-- Date: 2026-02-10
-- Description: Domain-based SSO routing - maps email domains to organizations for SSO login

CREATE TABLE IF NOT EXISTS `organization_sso_domains` (
  `id` varchar(128) NOT NULL,
  `organization_id` varchar(128) NOT NULL,
  `domain` varchar(255) NOT NULL,
  `verification_status` varchar(50) NOT NULL DEFAULT 'pending',
  `verification_token` varchar(255),
  `verified_at` timestamp(3) NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `organization_sso_domains_domain_unique` (`domain`),
  INDEX `organization_sso_domains_org_idx` (`organization_id`),
  CONSTRAINT `organization_sso_domains_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
);
