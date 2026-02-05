/**
 * Setup script that initializes the MySQL database and seeds a user.
 * This script automates the initial setup process for new installations.
 *
 * Usage:
 *   npm run setup
 *
 * Environment variables:
 *   SEED_SUPERADMIN_EMAIL    - Email for the superadmin (default: owner@example.com)
 *   SEED_SUPERADMIN_PASSWORD - Password for the superadmin (default: OwnerPass123!)
 *   SEED_SUPERADMIN_NAME     - Full name for the superadmin (default: Cloud Portal Owner)
 *   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME - Database connection
 */

import 'dotenv/config'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendDir = resolve(__dirname, '..')

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

function runCommand(command: string, cwd: string = frontendDir) {
  console.log(`Kor: ${command}`)
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      encoding: 'utf-8'
    })
  } catch (error) {
    console.error(`Kommandot misslyckades: ${command}`)
    throw error
  }
}

async function setup() {
  console.log('Startar setup av Cloud Portal MSP...\n')

  const dbUrl = buildMysqlUrl()

  // Check if database is initialized by trying to connect and query
  let dbInitialized = false
  try {
    const connection = await mysql.createConnection(dbUrl)
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    )
    dbInitialized = Array.isArray(tables) && tables.length > 0
    await connection.end()
  } catch (error) {
    console.log('Kunde inte ansluta till databasen, kommer att forsoka initialisera...')
  }

  // Initialize database if needed
  if (!dbInitialized) {
    console.log('Initialiserar databas...')

    try {
      runCommand('npm run db:push')
      console.log('Databas initialiserad!\n')
    } catch (error) {
      console.error('\nKunde inte initialisera databasen.')
      console.error('   Kontrollera att DB_HOST, DB_NAME etc. ar korrekt och att MySQL-servern ar tillganglig.')
      throw error
    }
  } else {
    console.log('Databas redan initialiserad, hoppar over db:push\n')
  }

  // Seed user
  console.log('Seedar anvandare...')
  runCommand('npm run seed:user')
  console.log('Setup klar!\n')

  console.log('Installationen ar klar! Du kan nu kora:')
  console.log('   npm run dev')
}

setup().catch((error) => {
  console.error('Setup misslyckades:', error)
  process.exit(1)
})
