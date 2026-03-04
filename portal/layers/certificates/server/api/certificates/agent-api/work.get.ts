import { eq, and, sql, lte } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireAgentAuth } from '../../../lib/certificates/agent-auth'
import { getDb } from '~~/server/utils/db'
import { LEASE_DEFAULTS } from '../../../lib/certificates/types'
import { certOrderRuns, certOrders } from '~~/server/database/schema'
import { generateDnsChallengeToken } from '../../../lib/certificates/dns-challenge-token'
import { getDnsChallengeProvider } from '../../../../../_shared/dns-challenge-providers'

export default defineEventHandler(async (event) => {
  const agent = await requireAgentAuth(event)
  const db = getDb()
  const now = new Date()

  // Recover stale leases: running runs whose lease has expired → reset to pending
  await db
    .update(certOrderRuns)
    .set({
      status: 'pending',
      leaseId: null,
      leasedUntil: null
    })
    .where(
      and(
        eq(certOrderRuns.agentId, agent.agentId),
        eq(certOrderRuns.status, 'running'),
        lte(certOrderRuns.leasedUntil, now)
      )
    )

  // Find oldest pending run for this agent
  const [pendingRun] = await db
    .select({
      id: certOrderRuns.id,
      orderId: certOrderRuns.orderId,
      runPayload: certOrderRuns.runPayload,
      runNumber: certOrderRuns.runNumber
    })
    .from(certOrderRuns)
    .where(
      and(
        eq(certOrderRuns.agentId, agent.agentId),
        eq(certOrderRuns.status, 'pending')
      )
    )
    .orderBy(certOrderRuns.createdAt)
    .limit(1)

  if (!pendingRun) {
    setResponseStatus(event, 204)
    return null
  }

  // Set lease
  const leaseId = createId()
  const leasedUntil = new Date(now.getTime() + LEASE_DEFAULTS.DURATION_MS)

  await db
    .update(certOrderRuns)
    .set({
      status: 'running',
      leaseId,
      leasedUntil,
      startedAt: now
    })
    .where(
      and(
        eq(certOrderRuns.id, pendingRun.id),
        eq(certOrderRuns.status, 'pending') // Optimistic lock
      )
    )

  // Update order status to processing
  await db
    .update(certOrders)
    .set({ status: 'processing' })
    .where(eq(certOrders.id, pendingRun.orderId))

  const payload = pendingRun.runPayload ? JSON.parse(pendingRun.runPayload) : null

  // Generate DNS challenge token if the run uses a portal-managed DNS provider
  let dnsChallengeToken: string | null = null
  const dnsProvider = payload?.validationMeta?.dnsProvider
  const dnsZoneId = payload?.validationMeta?.zoneId
  if (dnsProvider && dnsProvider !== 'manual' && dnsZoneId) {
    const provider = getDnsChallengeProvider(dnsProvider)
    if (provider) {
      dnsChallengeToken = generateDnsChallengeToken({
        runId: pendingRun.id,
        leaseId,
        agentId: agent.agentId,
        orgId: agent.organizationId,
        provider: dnsProvider,
        zoneId: dnsZoneId
      })
    }
  }

  return {
    runId: pendingRun.id,
    leaseId,
    leasedUntil: leasedUntil.toISOString(),
    payload,
    dnsChallengeToken
  }
})
