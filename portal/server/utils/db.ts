import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema'

export type DrizzleDb = MySql2Database<typeof schema>

let dbInstance: DrizzleDb | null = null

/**
 * Build a MySQL connection URL from individual DB_* environment variables.
 * Falls back to DATABASE_URL_MARIA if the individual variables are not set.
 */
export function buildMysqlUrl(): string {
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

  throw new Error(
    'Database configuration missing. Set DB_HOST + DB_NAME (recommended) or DATABASE_URL_MARIA in your .env file.'
  )
}

export const getDb = (): DrizzleDb => {
  if (dbInstance) return dbInstance

  const url = buildMysqlUrl()
  const pool = mysql.createPool(url)
  dbInstance = drizzle(pool, { schema, mode: 'default' })
  return dbInstance
}

export const resetDbInstance = () => {
  dbInstance = null
}
