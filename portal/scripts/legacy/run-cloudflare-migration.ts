import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
const migrationFile = join(process.cwd(), 'server/database/migrations/0030_cloudflare_dns_plugin.sql')

console.log('Running migration:', migrationFile)
console.log('Database:', dbPath)

const db = new Database(dbPath)
const sql = readFileSync(migrationFile, 'utf-8')

// Execute the entire SQL script
try {
  db.exec(sql)
  console.log('✓ Migration executed successfully')
  
  // Mark as applied in __drizzle_migrations
  db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run('0030_cloudflare_dns_plugin', Date.now())
  console.log('✓ Marked as applied in __drizzle_migrations')
} catch (error: any) {
  // Check if it's a "table already exists" or "index already exists" error
  if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
    console.log('⊘ Some objects already exist, continuing...')
  } else {
    console.error('✗ Error:', error.message)
    throw error
  }
}

db.close()
console.log('\n✅ Migration completed!')

