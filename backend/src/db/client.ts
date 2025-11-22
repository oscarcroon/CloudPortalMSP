import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultDbPath = path.resolve(currentDir, '..', '..', '..', 'frontend', '.data', 'dev.db')

const dbUrl = process.env.DATABASE_URL || `file:${defaultDbPath}`
const sqlitePath = dbUrl.startsWith('file:') ? dbUrl.slice('file:'.length) : dbUrl

const sqliteDir = path.dirname(sqlitePath)
fs.mkdirSync(sqliteDir, { recursive: true })

const sqlite = new Database(sqlitePath)
if (process.env.NODE_ENV !== 'production') {
  console.info(`[db] Using SQLite database at ${sqlitePath}`)
}

export const db = drizzle(sqlite, { schema })
export type DatabaseClient = typeof db


