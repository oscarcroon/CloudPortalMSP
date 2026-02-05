import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

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

  throw new Error('Database configuration missing. Set DB_HOST + DB_NAME or DATABASE_URL_MARIA.')
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: buildMysqlUrl()
  },
  strict: true,
  verbose: true
})
