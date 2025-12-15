const Database = require('better-sqlite3')
const { readFileSync } = require('fs')
const { join } = require('path')

const dbPath = join(process.cwd(), '.data/dev.db')
const migrationPath = join(process.cwd(), 'server/database/migrations/0035_msp_org_delegations.sql')

console.log('Database:', dbPath)
console.log('Migration:', migrationPath)

const db = new Database(dbPath)
const sql = readFileSync(migrationPath, 'utf-8')

console.log('\nApplying migration 0035_msp_org_delegations.sql...')
db.exec(sql)
console.log('✅ Migration applied successfully!')

db.close()




