import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../cloudmsp.db')

const db = new Database(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS org_api_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  hash_alg TEXT DEFAULT 'scrypt-v1' NOT NULL,
  hash_version INTEGER DEFAULT 1 NOT NULL,
  hash_params TEXT,
  salt TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  pepper_kid TEXT NOT NULL,
  scopes TEXT NOT NULL,
  resource_constraints TEXT,
  description TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER,
  revoked_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now') * 1000) NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
`)

// Create indexes if they don't exist
try {
  db.exec(`CREATE UNIQUE INDEX org_api_tokens_prefix_unique ON org_api_tokens (prefix);`)
} catch (e) {
  if (!e.message.includes('already exists')) throw e
}

try {
  db.exec(`CREATE INDEX org_api_tokens_org_idx ON org_api_tokens (organization_id);`)
} catch (e) {
  if (!e.message.includes('already exists')) throw e
}

try {
  db.exec(`CREATE INDEX org_api_tokens_org_active_idx ON org_api_tokens (organization_id, revoked_at);`)
} catch (e) {
  if (!e.message.includes('already exists')) throw e
}

console.log('✅ Table org_api_tokens created successfully')

db.close()

