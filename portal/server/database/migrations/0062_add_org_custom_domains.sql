-- Migration: Add custom domain support to organizations
-- This enables organizations to use their own custom domains for portal access

-- Add custom domain fields to organizations table
ALTER TABLE organizations ADD COLUMN custom_domain TEXT;
ALTER TABLE organizations ADD COLUMN custom_domain_verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE organizations ADD COLUMN custom_domain_verified_at INTEGER;
ALTER TABLE organizations ADD COLUMN custom_domain_verification_token TEXT;

-- Create unique index for organization custom domains
CREATE UNIQUE INDEX IF NOT EXISTS organizations_custom_domain_idx ON organizations(custom_domain);

-- Add verification token field to tenants table (for consistency)
ALTER TABLE tenants ADD COLUMN custom_domain_verification_token TEXT;
