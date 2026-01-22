-- Add delegation invitations table for invite flow
CREATE TABLE IF NOT EXISTS msp_org_delegation_invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL,
  permission_keys TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at INTEGER NOT NULL,
  delegation_expires_at INTEGER,
  accepted_at INTEGER,
  delegation_id TEXT REFERENCES msp_org_delegations(id) ON DELETE SET NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS msp_delegation_invites_token_idx ON msp_org_delegation_invitations(token);
CREATE INDEX IF NOT EXISTS msp_delegation_invites_org_email_idx ON msp_org_delegation_invitations(org_id, email);
