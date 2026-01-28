import Database from 'better-sqlite3'
import { join } from 'path'

const dbPath = join(process.cwd(), '.data/dev.db')

console.log('Checking database:', dbPath)

const db = new Database(dbPath)

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>
console.log('\nAll tables in database:')
tables.forEach(t => console.log('  -', t.name))

// Check specifically for delegation tables
const hasDelegations = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='msp_org_delegations'").get()
const hasPermissions = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='msp_org_delegation_permissions'").get()

console.log('\nDelegation tables:')
console.log('  msp_org_delegations:', hasDelegations ? '✅ EXISTS' : '❌ MISSING')
console.log('  msp_org_delegation_permissions:', hasPermissions ? '✅ EXISTS' : '❌ MISSING')

if (!hasDelegations || !hasPermissions) {
  console.log('\n❌ Delegation tables are missing!')
  console.log('Run: npm run --silent tsx scripts/apply-delegation-migration.ts')
  db.close()
  process.exit(1)
} else {
  // Check table structure
  const delegationsInfo = db.prepare("PRAGMA table_info(msp_org_delegations)").all()
  const permissionsInfo = db.prepare("PRAGMA table_info(msp_org_delegation_permissions)").all()
  
  console.log('\n✅ Delegation tables exist!')
  console.log('\nmsp_org_delegations columns:', delegationsInfo.length)
  console.log('msp_org_delegation_permissions columns:', permissionsInfo.length)
}

db.close()




