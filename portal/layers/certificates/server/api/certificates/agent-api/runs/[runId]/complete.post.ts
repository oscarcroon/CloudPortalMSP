import { eq, and } from 'drizzle-orm'
import { readBody, getRouterParam } from 'h3'
import { requireAgentAuth } from '../../../../../lib/certificates/agent-auth'
import { agentRunStatusSchema } from '../../../../../validation/schemas'
import { getDb } from '~~/server/utils/db'
import { LOG_REDACT_PATTERNS } from '../../../../../lib/certificates/types'
import type { RunResultMeta } from '../../../../../lib/certificates/types'
import { certOrderRuns, certOrders, certCertificates } from '~~/server/database/schema'

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

  const parsed = agentRunStatusSchema.parse(body)

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

  const now = new Date()
  const finalStatus = parsed.status === 'completed' ? 'completed' : 'failed'

  // Update run
  const runUpdates: Record<string, any> = {
    status: finalStatus,
    completedAt: now,
    leaseId: null,
    leasedUntil: null
  }

  if (parsed.logs) {
    const redacted = redactLogs(parsed.logs)
    runUpdates.logs = (run.logs ?? '') + redacted
  }

  if (parsed.errorMessage) runUpdates.errorMessage = parsed.errorMessage
  if (parsed.errorCode) runUpdates.errorCode = parsed.errorCode
  if (parsed.resultMeta) runUpdates.resultMeta = JSON.stringify(parsed.resultMeta)

  // Get the order for org context
  const [order] = await db
    .select()
    .from(certOrders)
    .where(eq(certOrders.id, run.orderId))

  await db.transaction(async (tx) => {
    await tx
      .update(certOrderRuns)
      .set(runUpdates)
      .where(eq(certOrderRuns.id, runId))

    // Update order status
    await tx
      .update(certOrders)
      .set({ status: finalStatus })
      .where(eq(certOrders.id, run.orderId))

    // On success: create certificate record
    if (finalStatus === 'completed' && parsed.resultMeta && order) {
      const meta = parsed.resultMeta as RunResultMeta
      const renewDaysBefore = order.renewDaysBefore ?? 30
      const expiresAt = meta.expiresAt ? new Date(meta.expiresAt) : null
      const nextRenewalAt = expiresAt
        ? new Date(expiresAt.getTime() - renewDaysBefore * 24 * 60 * 60 * 1000)
        : null

      await tx.insert(certCertificates).values({
        organizationId: order.organizationId,
        orderId: order.id,
        credentialSetId: order.credentialSetId,
        primaryDomain: order.primaryDomain,
        subjectAlternativeNames: order.subjectAlternativeNames,
        issuer: meta.issuer ?? null,
        serialNumber: meta.serial ?? null,
        thumbprint: meta.thumbprint ?? null,
        providerOrderId: meta.providerOrderId ?? null,
        acmeAccountThumbprint: meta.acmeAccountThumbprint ?? null,
        renewalName: order.renewalName,
        issuedAt: now,
        expiresAt,
        installationTarget: order.installationTarget,
        installationMeta: order.installationMeta,
        nextRenewalAt,
        status: 'active'
      })
    }
  })

  return { ok: true, status: finalStatus }
})
