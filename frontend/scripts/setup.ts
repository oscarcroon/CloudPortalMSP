/**
 * Setup script that initializes the database and seeds a user.
 * This script automates the initial setup process for new installations.
 * 
 * Usage:
 *   npm run setup
 *   
 * Environment variables:
 *   SEED_SUPERADMIN_EMAIL    - Email for the superadmin (default: owner@example.com)
 *   SEED_SUPERADMIN_PASSWORD - Password for the superadmin (default: OwnerPass123!)
 *   SEED_SUPERADMIN_NAME     - Full name for the superadmin (default: Cloud Portal Owner)
 *   DATABASE_URL             - SQLite database path (default: file:./.data/dev.db)
 */

import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendDir = resolve(__dirname, '..')

function runCommand(command: string, cwd: string = frontendDir) {
  console.log(`▶️  Kör: ${command}`)
  try {
    execSync(command, { 
      cwd,
      stdio: 'inherit',
      encoding: 'utf-8'
    })
  } catch (error) {
    console.error(`❌ Kommandot misslyckades: ${command}`)
    throw error
  }
}

async function setup() {
  console.log('🚀 Startar setup av Cloud Portal MSP...\n')

  // Check if database exists and has tables
  const dbUrl = process.env.DATABASE_URL || 'file:./.data/dev.db'
  const dbPath = resolve(frontendDir, dbUrl.replace('file:', ''))
  const dbExists = existsSync(dbPath)

  // Check if users table exists (indicates database is initialized)
  let dbInitialized = false
  if (dbExists) {
    try {
      const Database = (await import('better-sqlite3')).default
      const db = new Database(dbPath)
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).get()
      db.close()
      dbInitialized = !!tableExists
    } catch (error) {
      // Database might be corrupted or not readable, we'll recreate it
      console.log('⚠️  Kunde inte läsa databasen, kommer att skapa ny...')
    }
  }

  // Initialize database if needed
  if (!dbInitialized) {
    console.log('📦 Initialiserar databas...')
    runCommand('npm run db:push')
    console.log('✅ Databas initialiserad!\n')
  } else {
    console.log('✅ Databas redan initialiserad, hoppar över db:push\n')
  }

  // Seed user
  console.log('🌱 Seedar användare...')
  runCommand('npm run seed:user')
  console.log('✅ Setup klar!\n')

  console.log('🎉 Installationen är klar! Du kan nu köra:')
  console.log('   npm run dev')
}

setup().catch((error) => {
  console.error('❌ Setup misslyckades:', error)
  process.exit(1)
})
