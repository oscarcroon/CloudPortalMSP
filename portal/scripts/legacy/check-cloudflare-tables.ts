import Database from 'better-sqlite3'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
const db = new Database(dbPath)

try {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cloudflare_dns%'").all()
  console.log('Cloudflare tables:', JSON.stringify(result, null, 2))
  
  const modulesTable = db.prepare("PRAGMA table_info(modules)").all()
  const hasEnabledColumn = modulesTable.some((col: any) => col.name === 'enabled')
  console.log('\nModules table has "enabled" column:', hasEnabledColumn)
  
  const migrations = db.prepare('SELECT hash FROM __drizzle_migrations ORDER BY created_at').all()
  console.log('\nApplied migrations count:', migrations.length)
  console.log('Last 5 migrations:', JSON.stringify(migrations.slice(-5), null, 2))
} catch (e: any) {
  console.log('Error:', e.message)
}

db.close()

