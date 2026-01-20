const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const dbPath = path.resolve(__dirname, '..', '.data', 'dev.db')
const migrationPath = path.resolve(__dirname, '..', 'server', 'database', 'migrations', '0037_fix_msp_delegation_permissions_fk.sql')

// Ensure .data directory exists
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)
const sql = fs.readFileSync(migrationPath, 'utf8')

console.log('Applying migration 0037_fix_msp_delegation_permissions_fk...')
try {
  db.exec(sql)
  console.log('✅ Migration applied successfully!')
} catch (error) {
  console.error('❌ Error applying migration:', error.message)
  process.exit(1)
} finally {
  db.close()
}


