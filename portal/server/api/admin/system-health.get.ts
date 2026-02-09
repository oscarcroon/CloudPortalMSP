import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import { requireSuperAdmin } from '~~/server/utils/rbac'
import { getDb } from '~~/server/utils/db'
import { manifests } from '~~/layers/plugin-manifests'

interface HealthCheckResult {
  status: 'ok' | 'error' | 'unconfigured'
  latency_ms: number
  message?: string
}

/**
 * GET /api/admin/system-health
 *
 * Aggregates health checks from DB + all plugin modules that declare a healthCheck.
 * Requires super admin auth.
 */
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  // 1. Database health
  let dbResult: HealthCheckResult
  try {
    const dbStart = Date.now()
    const db = getDb()
    await db.execute(sql`SELECT 1`)
    dbResult = { status: 'ok', latency_ms: Date.now() - dbStart }
  } catch (err: any) {
    dbResult = { status: 'error', latency_ms: 0, message: err?.message || 'Database unreachable' }
  }

  // 2. Plugin integration health checks
  const integrationChecks = manifests
    .filter(m => m.healthCheck)
    .map(m => ({
      key: m.module.key,
      label: m.healthCheck!.label,
      endpoint: m.healthCheck!.endpoint,
      timeout: m.healthCheck!.timeout ?? 5000
    }))

  const integrations = await Promise.all(
    integrationChecks.map(async (check) => {
      try {
        const result = await $fetch<HealthCheckResult>(check.endpoint, {
          timeout: check.timeout
        })
        return {
          key: check.key,
          label: check.label,
          status: result.status,
          latency_ms: result.latency_ms,
          message: result.message
        }
      } catch (err: any) {
        return {
          key: check.key,
          label: check.label,
          status: 'error' as const,
          latency_ms: 0,
          message: err?.message || 'Health check failed'
        }
      }
    })
  )

  return {
    database: dbResult,
    integrations,
    checkedAt: new Date().toISOString()
  }
})
