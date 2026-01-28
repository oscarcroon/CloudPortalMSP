import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'

const dbPath = join(process.cwd(), '.data/dev.db')

console.log('='.repeat(60))
console.log('Fixing delegation tables')
console.log('='.repeat(60))
console.log('Database:', dbPath)
console.log('Database exists:', existsSync(dbPath))
console.log('')

const db = new Database(dbPath)

// Drop existing tables if they exist
console.log('Dropping existing tables...')
try {
  db.exec('DROP TABLE IF EXISTS msp_org_delegation_permissions')
  db.exec('DROP TABLE IF EXISTS msp_org_delegations')
  console.log('✅ Old tables dropped')
} catch (error: any) {
  console.error('Error dropping tables:', error.message)
}

// Create tables with correct foreign keys
const sql = `
CREATE TABLE IF NOT EXISTS msp_org_delegations (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  created_by text,
  expires_at integer,
  note text,
  revoked_at integer,
  revoked_by text,
  created_at integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  updated_at integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (subject_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (revoked_by) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);

CREATE TABLE IF NOT EXISTS msp_org_delegation_permissions (
  delegation_id text NOT NULL,
  permission_key text NOT NULL,
  PRIMARY KEY (delegation_id, permission_key),
  FOREIGN KEY (delegation_id) REFERENCES msp_org_delegations(id) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS msp_org_delegations_active_unique ON msp_org_delegations (org_id, subject_type, subject_id, COALESCE(revoked_at, 0), COALESCE(expires_at, 0));
CREATE INDEX IF NOT EXISTS msp_org_delegations_subject_idx ON msp_org_delegations (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS msp_org_delegations_org_idx ON msp_org_delegations (org_id);
CREATE INDEX IF NOT EXISTS msp_org_delegations_expires_idx ON msp_org_delegations (expires_at);
CREATE INDEX IF NOT EXISTS msp_org_delegations_revoked_idx ON msp_org_delegations (revoked_at);
CREATE INDEX IF NOT EXISTS msp_org_delegation_permissions_perm_idx ON msp_org_delegation_permissions (permission_key);
`

console.log('\nCreating tables with correct foreign keys...')
try {
  db.exec(sql)
  console.log('✅ Tables created successfully!')
  
  // Verify
  const hasDelegations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='msp_org_delegations'").get()
  const hasPermissions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='msp_org_delegation_permissions'").get()
  
  console.log('\nVerification:')
  console.log('  msp_org_delegations:', hasDelegations ? '✅' : '❌')
  console.log('  msp_org_delegation_permissions:', hasPermissions ? '✅' : '❌')
  
  if (!hasDelegations || !hasPermissions) {
    console.error('\n❌ Tables were not created!')
    db.close()
    process.exit(1)
  }
} catch (error: any) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  db.close()
  process.exit(1)
}

db.close()
console.log('\n✅ Done!')




