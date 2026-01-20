// Temporary helper: apply pending SQL migrations directly to the SQLite DB.
// Usage: from repo root:
//   node frontend/scripts/apply-missing-migrations.js

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

// Get the directory where this script is located
const __filename = new URL(import.meta.url).pathname
const scriptDir = path.dirname(__filename.replace(/^\/([A-Z]:)/, '$1')) // Fix Windows path
const repoRoot = path.resolve(scriptDir, '..')
const dbPath = path.resolve(repoRoot, '.data', 'dev.db')
const migrationsDir = path.resolve(repoRoot, 'server', 'database', 'migrations')
const files = [
  '0032_plugin_acl.sql',
  '0033_org_groups_slug.sql',
  '0034_drop_legacy_module_roles.sql',
  '0035_msp_org_delegations.sql',
  '0036_org_group_module_permissions.sql',
  '0037_fix_msp_delegation_permissions_fk.sql',
  '0038_add_coming_soon_message.sql',
  '0039_add_module_status_fields.sql',
  '0040_add_msp_delegation_source.sql',
  '0041_create_msp_roles.sql',
  '0042_add_module_permissions_lifecycle.sql',
  '0043_update_msp_roles_schema.sql'
]

// Ensure directory exists
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db = new Database(dbPath)

for (const file of files) {
  const full = path.join(migrationsDir, file)
  if (!fs.existsSync(full)) {
    console.log(`Skipping ${file} (file not found)`)
    continue
  }
  const sql = fs.readFileSync(full, 'utf8')
  console.log(`Applying ${file}...`)
  try {
    db.exec(sql)
    console.log(`✓ ${file} applied successfully`)
  } catch (err) {
    if (err.code === 'SQLITE_ERROR' && err.message.includes('duplicate column') || err.message.includes('already exists')) {
      console.log(`⚠ ${file} skipped (already applied)`)
    } else {
      console.error(`✗ Error applying ${file}:`, err.message)
      throw err
    }
  }
}

console.log('Done.')




