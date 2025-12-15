import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { readdirSync } from 'fs'
import { join } from 'path'

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '.data/dev.db'
const migrationsDir = join(process.cwd(), 'server/database/migrations')

console.log('Database:', dbPath)
console.log('Migrations directory:', migrationsDir)

const db = new Database(dbPath)

// Create __drizzle_migrations table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at integer
  )
`)

// Get all SQL migration files, sorted by number
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0')
    const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0')
    return numA - numB
  })

console.log(`\nFound ${migrationFiles.length} migration files`)

// Get existing migrations from database
const existingMigrations = db.prepare('SELECT hash FROM __drizzle_migrations').all() as Array<{ hash: string }>
const existingHashes = new Set(existingMigrations.map(m => m.hash))

let added = 0
let skipped = 0

// Mark all migrations as applied (except the last 2 new ones: 0030 and 0031)
for (const file of migrationFiles) {
  const filePath = join(migrationsDir, file)
  const sql = readFileSync(filePath, 'utf-8')
  
  // Create a simple hash from the filename (Drizzle uses content hash, but we'll use filename for simplicity)
  const hash = file.replace('.sql', '')
  
  // Skip the last 2 migrations (0030 and 0031) - these should be run by drizzle-kit migrate
  if (file.startsWith('0030_') || file.startsWith('0031_')) {
    console.log(`⊘ Skipping ${file} (new migration, will be run by drizzle-kit)`)
    skipped++
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

console.log(`\n✅ Done! Added ${added} migrations, skipped ${skipped} (including 2 new ones to be run)`)

