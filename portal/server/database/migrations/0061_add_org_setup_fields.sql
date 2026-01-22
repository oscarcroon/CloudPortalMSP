-- Add setup wizard fields to organizations table
-- setupStatus: 'pending' = needs wizard, 'complete' = ready to use
-- setupCompletedAt: timestamp when wizard was completed
-- defaultGroupId: auto-assign new members to this org group

-- Add columns with defaults so existing orgs are set to 'complete' (not stuck in wizard)
ALTER TABLE organizations ADD COLUMN setup_status TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE organizations ADD COLUMN setup_completed_at INTEGER;
ALTER TABLE organizations ADD COLUMN default_group_id TEXT;
