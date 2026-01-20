// Temporary helper: apply pending SQL migrations directly to the SQLite DB.
// Usage: from repo root:
//   node frontend/scripts/apply-missing-migrations.js

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dbPath = path.resolve('frontend/.data/dev.db')
const migrationsDir = path.resolve('frontend/server/database/migrations')
const files = [
  '0032_plugin_acl.sql',
  '0033_org_groups_slug.sql',
  '0034_drop_legacy_module_roles.sql',
  '0035_msp_org_delegations.sql',
  '0036_org_group_module_permissions.sql'
]

const db = new Database(dbPath)

for (const file of files) {
  const full = path.join(migrationsDir, file)
  const sql = fs.readFileSync(full, 'utf8')
  console.log(`Applying ${file}`)
  db.exec(sql)
}

console.log('Done.')




