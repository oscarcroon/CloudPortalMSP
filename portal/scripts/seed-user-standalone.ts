/**
 * Standalone seed script that creates a superadmin user in the MySQL database.
 *
 * Usage:
 *   npm run seed:user
 *
 * Environment variables:
 *   SEED_SUPERADMIN_EMAIL    - Email for the superadmin (default: owner@example.com)
 *   SEED_SUPERADMIN_PASSWORD - Password for the superadmin (default: OwnerPass123!)
 *   SEED_SUPERADMIN_NAME     - Full name for the superadmin (default: Cloud Portal Owner)
 *   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME - Database connection
 */

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendDir = resolve(__dirname, '..')

// Simple ID generator (cuid2-like format without external dependency)
function createId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = randomBytes(12).toString('base64url').slice(0, 16)
  return `${timestamp}${randomPart}`.slice(0, 24)
}

function buildMysqlUrl(): string {
  const host = process.env.DB_HOST
  const name = process.env.DB_NAME

  if (host && name) {
    const user = process.env.DB_USER || 'root'
    const password = process.env.DB_PASSWORD || ''
    const port = process.env.DB_PORT || '3306'
    const credentials = password ? `${user}:${password}` : user
    return `mysql://${credentials}@${host}:${port}/${name}`
  }

  if (process.env.DATABASE_URL_MARIA) {
    return process.env.DATABASE_URL_MARIA
  }

  console.error('Database configuration missing. Set DB_HOST + DB_NAME in portal/.env')
  process.exit(1)
}

// Configuration
const superAdminEmail = process.env.SEED_SUPERADMIN_EMAIL || 'owner@example.com'
const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'OwnerPass123!'
const superAdminName = process.env.SEED_SUPERADMIN_NAME || 'Cloud Portal Owner'

const dbUrl = buildMysqlUrl()

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

async function seed() {
  console.log('Startar seed av anvandare...')
  console.log(`Databas: ${process.env.DB_HOST || 'via URL'}:${process.env.DB_PORT || '3306'}/${process.env.DB_NAME || ''}`)

  const connection = await mysql.createConnection(dbUrl)

  try {
    // Check if users table exists
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    )

    if (!Array.isArray(tables) || tables.length === 0) {
      console.log('Tabellen "users" finns inte. Forsoker initialisera databasen...')

      try {
        console.log('Kor db:push for att skapa tabellerna...')
        execSync('npm run db:push', {
          cwd: frontendDir,
          stdio: 'inherit',
          encoding: 'utf-8'
        })
        console.log('Databas initialiserad!')

        // Verify tables were created
        const [tablesAfter] = await connection.execute(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
        )

        if (!Array.isArray(tablesAfter) || tablesAfter.length === 0) {
          console.error('Tabellen "users" finns fortfarande inte efter db:push.')
          console.error('   Kor manuellt: npm run db:push')
          process.exitCode = 1
          return
        }
      } catch (pushError) {
        console.error('Kunde inte kora db:push automatiskt.')
        console.error('   Kor manuellt: npm run db:push')
        console.error('   Eller anvand: npm run setup')
        process.exitCode = 1
        return
      }
    }

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ?',
      [superAdminEmail]
    )

    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`Anvandare med email ${superAdminEmail} finns redan. Hoppar over.`)
      return
    }

    // Hash password
    const passwordHash = await hashPassword(superAdminPassword)
    const userId = createId()
    const now = new Date()

    // Insert user
    await connection.execute(
      `INSERT INTO users (
        id, email, password_hash, full_name, status,
        is_super_admin, default_org_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        superAdminEmail,
        passwordHash,
        superAdminName,
        'active',
        true,
        null,
        now,
        now
      ]
    )

    console.log('Anvandare skapad!')
    console.log(`Email: ${superAdminEmail}`)
    console.log(`Losenord: ${superAdminPassword}`)
    console.log(`User ID: ${userId}`)

  } catch (error) {
    console.error('Misslyckades med att skapa anvandare:', error)
    process.exitCode = 1
  } finally {
    await connection.end()
  }
}

seed()
