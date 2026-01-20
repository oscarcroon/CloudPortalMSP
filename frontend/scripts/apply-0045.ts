/**
 * Manually apply migration 0045 - recreate member_module_role_overrides table
 */
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.resolve(__dirname, '../.data/dev.db')
console.log('Database path:', dbPath)

const db = new Database(dbPath)

console.log('Creating member_module_role_overrides table...')

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_module_role_overrides (
      id text PRIMARY KEY NOT NULL,
      organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id text NOT NULL,
      role_key text NOT NULL,
      effect text NOT NULL,
      created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
      updated_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
      created_at integer,
      updated_at integer
    )
  `)
  console.log('✓ Table created')
} catch (err: any) {
  if (err.message.includes('already exists')) {
    console.log('✓ Table already exists')
  } else {
    console.error('Error creating table:', err.message)
  }
}

try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS member_module_role_overrides_unique ON member_module_role_overrides (organization_id, user_id, module_id, role_key)`)
  console.log('✓ Unique index created')
} catch (err: any) {
  console.log('Index creation result:', err.message)
}

try {
  db.exec(`CREATE INDEX IF NOT EXISTS member_module_role_overrides_org_idx ON member_module_role_overrides (organization_id, module_id)`)
  console.log('✓ Org index created')
} catch (err: any) {
  console.log('Index creation result:', err.message)
}

// Verify the table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='member_module_role_overrides'").all()
console.log('\nVerification - table exists:', tables.length > 0)

db.close()
console.log('\nDone!')

