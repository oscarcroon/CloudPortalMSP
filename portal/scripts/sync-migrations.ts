/**
 * Sync migrations table with all SQL migration files.
 * Marks all migrations up to (but not including) a specified new migration as applied.
 * 
 * Usage: npx tsx scripts/sync-migrations.ts [last_new_migration]
 * Example: npx tsx scripts/sync-migrations.ts 0044
 * 
 * This will mark all migrations BEFORE 0044 as applied, allowing 0044 to be run fresh.
 */

import Database from 'better-sqlite3'
import { readdirSync } from 'fs'
import { join } from 'path'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
const migrationsDir = join(process.cwd(), 'server/database/migrations')

// Get the last new migration number from args (default: mark ALL as applied)
const lastNewMigration = process.argv[2] || '9999'
const lastNewNumber = parseInt(lastNewMigration.match(/^(\d+)/)?.[1] || '9999')

console.log('Database:', dbPath)
console.log('Migrations directory:', migrationsDir)
console.log(`Will mark migrations before ${lastNewNumber.toString().padStart(4, '0')} as applied\n`)

const db = new Database(dbPath)

// Create __drizzle_migrations table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  )
`)

// Get all SQL migration files, sorted by number
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0')
    const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0')
    if (numA !== numB) return numA - numB
    return a.localeCompare(b)
  })

console.log(`Found ${migrationFiles.length} migration files\n`)

// Get existing migrations from database
const existingMigrations = db.prepare('SELECT hash FROM __drizzle_migrations').all() as Array<{ hash: string }>
const existingHashes = new Set(existingMigrations.map(m => m.hash))

let added = 0
let skipped = 0
let toRun = 0

for (const file of migrationFiles) {
  const migNum = parseInt(file.match(/^(\d+)/)?.[1] || '0')
  const hash = file.replace('.sql', '')
  
  if (migNum >= lastNewNumber) {
    console.log(`→ Will run: ${file}`)
    toRun++
    continue
  }
  
  if (existingHashes.has(hash)) {
    console.log(`⊘ Already marked: ${file}`)
    skipped++
    continue
  }
  
  // Insert migration record
  db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run(hash, Date.now())
  
  console.log(`✓ Marked as applied: ${file}`)
  added++
}

db.close()

console.log(`\n✅ Done!`)
console.log(`   Marked as applied: ${added}`)
console.log(`   Already marked: ${skipped}`)
console.log(`   To be run: ${toRun}`)
console.log(`\nNow run: npm run db:migrate`)
