// Apply migration 0048_windows_dns_blocked_zones.sql
// Usage: tsx scripts/apply-0048.ts

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const repoRoot = path.resolve(scriptDir, '..')
const dbPath = path.resolve(repoRoot, '.data', 'dev.db')
const migrationFile = path.resolve(repoRoot, 'server', 'database', 'migrations', '0048_windows_dns_blocked_zones.sql')

// Ensure directory exists
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

if (!fs.existsSync(migrationFile)) {
  console.error(`Migration file not found: ${migrationFile}`)
  process.exit(1)
}

const db = new Database(dbPath)

console.log('Applying migration 0048_windows_dns_blocked_zones.sql...')

try {
  const sql = fs.readFileSync(migrationFile, 'utf8')
  db.exec(sql)
  console.log('✓ Migration 0048 applied successfully')
} catch (err: any) {
  if (err.code === 'SQLITE_ERROR' && (err.message.includes('duplicate column') || err.message.includes('already exists'))) {
    console.log('⚠ Migration 0048 skipped (already applied)')
  } else {
    console.error('✗ Error applying migration 0048:', err.message)
    throw err
  }
}

db.close()
console.log('Done.')

