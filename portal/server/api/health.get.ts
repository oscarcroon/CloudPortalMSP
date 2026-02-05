import { sql } from 'drizzle-orm'
import { getDb } from '../utils/db'

export default defineEventHandler(async () => {
  const startTime = Date.now()

  // Check database connection
  let dbStatus = 'ok'
  let dbLatency = 0

  try {
    const dbStart = Date.now()
    const db = getDb()
    await db.execute(sql`SELECT 1`)
    dbLatency = Date.now() - dbStart
  } catch {
    dbStatus = 'error'
  }

  const healthy = dbStatus === 'ok'

  return {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    checks: {
      database: {
        status: dbStatus,
        latency_ms: dbLatency
      }
    },
    response_time_ms: Date.now() - startTime
  }
})
