import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema'

const require = createRequire(import.meta.url)

type SqliteDb = BetterSQLite3Database<typeof schema>
type MysqlDb = MySql2Database<typeof schema>
type DrizzleDbInstance = SqliteDb | MysqlDb
export type DrizzleDb = SqliteDb

let dbInstance: DrizzleDbInstance | null = null

const resolveSqlitePath = () => {
  // Standard: lokal frontend-DB under .data
  const rawUrl = process.env.DATABASE_URL ?? 'file:./.data/dev.db'
  const cleaned = rawUrl.startsWith('file:') ? rawUrl.replace('file:', '') : rawUrl
  const absolute = path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_DB) {
    console.log('[db] Using database:', absolute)
    console.log('[db] Database exists:', fs.existsSync(absolute))
  }
  return absolute
}

const createSqliteDb = (): SqliteDb => {
  let Database: typeof import('better-sqlite3')
  try {
    Database = require('better-sqlite3')
  } catch (error) {
    throw new Error(
      'better-sqlite3 is not installed. Install optional dependency or switch DB_DIALECT=mysql.'
    )
  }

  const sqlite = new Database(resolveSqlitePath())
  return drizzleSqlite(sqlite, { schema })
}

const createMysqlDb = (): MysqlDb => {
  const url = process.env.DATABASE_URL_MARIA
  if (!url) {
    throw new Error('DATABASE_URL_MARIA is required when DB_DIALECT=mysql')
  }

  const pool = mysql.createPool(url)
  return drizzleMysql(pool, { schema } as any)
}

const determineDialect = () =>
  (process.env.DB_DIALECT ?? process.env.DRIZZLE_DIALECT ?? 'sqlite').toLowerCase()

export const getDb = (): DrizzleDb => {
  if (dbInstance) {
    return dbInstance as DrizzleDb
  }

  const dialect = determineDialect()
  dbInstance = dialect === 'mysql' ? createMysqlDb() : createSqliteDb()
  return dbInstance as DrizzleDb
}

export const resetDbInstance = () => {
  dbInstance = null
}

