import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const dialect = process.env.DRIZZLE_DIALECT === 'mysql' ? 'mysql' : 'sqlite'

const sqliteCredentials = {
  url: process.env.DATABASE_URL ?? 'file:./.data/dev.db'
}

const mysqlCredentials = {
  url: process.env.DATABASE_URL_MARIA ?? ''
}

export default defineConfig({
  schema: './src/server/database/schema.ts',
  out: process.env.DRIZZLE_OUT ?? './src/server/database/migrations',
  dialect,
  dbCredentials: dialect === 'mysql' ? mysqlCredentials : sqliteCredentials,
  strict: true,
  verbose: true
})

