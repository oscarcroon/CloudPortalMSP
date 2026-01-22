import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const dbPath = join(process.cwd(), '.data/dev.db')
const migrationPath = join(process.cwd(), 'server/database/migrations/0035_msp_org_delegations.sql')

console.log('Current working directory:', process.cwd())
console.log('Database path:', dbPath)
console.log('Database exists:', existsSync(dbPath))
console.log('Migration path:', migrationPath)
console.log('Migration exists:', existsSync(migrationPath))

if (!existsSync(migrationPath)) {
  console.error('❌ Migration file not found!')
  process.exit(1)
}

const db = new Database(dbPath)
const sql = readFileSync(migrationPath, 'utf-8')

// Check if tables already exist
const checkTable = (name: string) => {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name)
  return !!result
}

const tablesBefore = {
  delegations: checkTable('msp_org_delegations'),
  permissions: checkTable('msp_org_delegation_permissions')
}

console.log('\nTables before migration:')
console.log('  msp_org_delegations:', tablesBefore.delegations)
console.log('  msp_org_delegation_permissions:', tablesBefore.permissions)

console.log('\nApplying migration 0035_msp_org_delegations.sql...')

// Split SQL into individual statements and execute one by one
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i]
  if (!statement) continue
  
  try {
    console.log(`  Executing statement ${i + 1}/${statements.length}...`)
    db.exec(statement + ';')
  } catch (error: any) {
    console.error(`  ❌ Error in statement ${i + 1}:`, error.message)
    console.error(`  Statement: ${statement.substring(0, 100)}...`)
    // Continue with next statement
  }
}

console.log('✅ All SQL statements executed!')

// Verify tables were created
const tablesAfter = {
  delegations: checkTable('msp_org_delegations'),
  permissions: checkTable('msp_org_delegation_permissions')
}

console.log('\nTables after migration:')
console.log('  msp_org_delegations:', tablesAfter.delegations)
console.log('  msp_org_delegation_permissions:', tablesAfter.permissions)

if (tablesAfter.delegations && tablesAfter.permissions) {
  console.log('\n✅ Migration applied successfully!')
} else {
  console.error('\n❌ Tables were not created!')
  db.close()
  process.exit(1)
}

db.close()

