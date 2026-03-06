import { eq, and } from 'drizzle-orm'
import { readBody, getRouterParam } from 'h3'
import { requireAgentAuth } from '../../../../../lib/certificates/agent-auth'
import { getDb } from '~~/server/utils/db'
import { LEASE_DEFAULTS, LOG_REDACT_PATTERNS } from '../../../../../lib/certificates/types'
import { certOrderRuns } from '~~/server/database/schema'

function redactLogs(logs: string): string {
  let redacted = logs
  for (const pattern of LOG_REDACT_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}

export default defineEventHandler(async (event) => {
  const agent = await requireAgentAuth(event)
  const runId = getRouterParam(event, 'runId')
  if (!runId) throw createError({ statusCode: 400, message: 'Missing run ID.' })

  const body = await readBody(event)
  const leaseId = body?.leaseId
  if (!leaseId) throw createError({ statusCode: 400, message: 'Missing leaseId.' })

  const db = getDb()

  // Validate run ownership and lease
  const [run] = await db
    .select()
    .from(certOrderRuns)
    .where(
      and(
        eq(certOrderRuns.id, runId),
        eq(certOrderRuns.agentId, agent.agentId)
      )
    )

  if (!run) {
    throw createError({ statusCode: 404, message: 'Run not found.' })
  }

  if (run.leaseId !== leaseId) {
    throw createError({ statusCode: 403, message: 'Lease ID mismatch.' })
  }

  if (run.status !== 'running') {
    throw createError({ statusCode: 409, message: `Run is not in running state: ${run.status}` })
  }

  // Sequence-based deduplication: skip if we've already processed this sequence
  const sequence = typeof body.sequence === 'number' ? body.sequence : null
  if (sequence !== null && run.lastLogSequence !== null && sequence <= run.lastLogSequence) {
    // Already processed — return ok to unblock the agent without re-appending logs
    const now = new Date()
    return { ok: true, leasedUntil: new Date(now.getTime() + LEASE_DEFAULTS.EXTENSION_MS).toISOString() }
  }

  const updates: Record<string, any> = {}

  // Append logs (redacted)
  if (body.logs) {
    const redacted = redactLogs(body.logs)
    const existingLogs = run.logs ?? ''
    updates.logs = existingLogs + redacted
  }

  // Track sequence for dedup
  if (sequence !== null) {
    updates.lastLogSequence = sequence
  }

  // Extend lease
  const now = new Date()
  updates.leasedUntil = new Date(now.getTime() + LEASE_DEFAULTS.EXTENSION_MS)

  await db
    .update(certOrderRuns)
    .set(updates)
    .where(eq(certOrderRuns.id, runId))

  return { ok: true, leasedUntil: updates.leasedUntil.toISOString() }
})
