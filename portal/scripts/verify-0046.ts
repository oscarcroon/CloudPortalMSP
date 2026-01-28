// Verify migration 0046 was applied correctly
import path from 'node:path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(__filename)
const repoRoot = path.resolve(scriptDir, '..')
const dbPath = path.resolve(repoRoot, '.data', 'dev.db')

const db = new Database(dbPath)

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'windows_dns%'").all() as Array<{ name: string }>

console.log('Windows DNS tables found:')
tables.forEach(t => {
  console.log(`  ✓ ${t.name}`)
})

const expectedTables = [
  'windows_dns_org_config',
  'windows_dns_allowed_zones',
  'windows_dns_last_discovery'
]

const foundTableNames = tables.map(t => t.name)
const missing = expectedTables.filter(t => !foundTableNames.includes(t))

if (missing.length > 0) {
  console.error('\n✗ Missing tables:', missing.join(', '))
  process.exit(1)
} else {
  console.log('\n✓ All expected tables exist!')
}

db.close()


