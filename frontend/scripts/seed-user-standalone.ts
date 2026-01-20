/**
 * Standalone seed script that doesn't depend on Nuxt path aliases.
 * This script directly creates a superadmin user in the database.
 * 
 * Usage:
 *   npm run seed:user
 *   
 * Environment variables:
 *   SEED_SUPERADMIN_EMAIL    - Email for the superadmin (default: owner@example.com)
 *   SEED_SUPERADMIN_PASSWORD - Password for the superadmin (default: OwnerPass123!)
 *   SEED_SUPERADMIN_NAME     - Full name for the superadmin (default: Cloud Portal Owner)
 *   DATABASE_URL             - SQLite database path (default: file:./.data/dev.db)
 */

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'
import { randomBytes } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simple ID generator (cuid2-like format without external dependency)
function createId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = randomBytes(12).toString('base64url').slice(0, 16)
  return `${timestamp}${randomPart}`.slice(0, 24)
}

// Configuration
const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'owner@example.com'
const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const superAdminName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

// Database path - match drizzle.config.ts default: file:./.data/dev.db
const dbUrl = process.env.DATABASE_URL || 'file:./.data/dev.db'
const dbPath = resolve(__dirname, '..', dbUrl.replace('file:', ''))

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function seed() {
  console.log('🌱 Startar seed av användare...')
  console.log(`📁 Databas: ${dbPath}`)

  // Ensure data directory exists (create it if it doesn't)
  const dataDir = dirname(dbPath)
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
    console.log(`📁 Skapade data-katalog: ${dataDir}`)
  }
  
  // Create empty database file if it doesn't exist (drizzle will create tables)
  if (!existsSync(dbPath)) {
    const db = new Database(dbPath)
    db.close()
    console.log(`📁 Skapade tom databas-fil: ${dbPath}`)
  }

  // Open database
  const db = new Database(dbPath)
  
  try {
    // Check if users table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `).get()

    if (!tableExists) {
      console.error('❌ Tabellen "users" finns inte. Kör först:')
      console.error('   npm run db:push')
      console.error('   eller')
      console.error('   npm run db:migrate')
      process.exitCode = 1
      return
    }

    // Check if user already exists
    const existing = db.prepare(`
      SELECT id, email FROM users WHERE email = ?
    `).get(superAdminEmail)

    if (existing) {
      console.log(`⚠️  Användare med email ${superAdminEmail} finns redan. Hoppar över.`)
      return
    }

    // Hash password
    const passwordHash = await hashPassword(superAdminPassword)
    const userId = createId()
    const now = Date.now()

    // Insert user
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, status, 
        is_super_admin, default_org_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      superAdminEmail,
      passwordHash,
      superAdminName,
      'active',
      1, // is_super_admin = true
      null, // default_org_id
      now,
      now
    )

    console.log(`✅ Användare skapad!`)
    console.log(`📧 Email: ${superAdminEmail}`)
    console.log(`🔑 Lösenord: ${superAdminPassword}`)
    console.log(`🆔 User ID: ${userId}`)

  } catch (error) {
    console.error('❌ Misslyckades med att skapa användare:', error)
    process.exitCode = 1
  } finally {
    db.close()
  }
}

seed()
