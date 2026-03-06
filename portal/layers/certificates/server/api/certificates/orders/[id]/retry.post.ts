import { eq, and, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../../lib/certificates/access'
import { certOrders, certOrderRuns } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing order ID.' })

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canOrder && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to retry orders.' })
    }
  }

  const db = getDb()
  const [order] = await db
    .select()
    .from(certOrders)
    .where(and(eq(certOrders.id, id), eq(certOrders.organizationId, orgId)))

  if (!order) {
    throw createError({ statusCode: 404, message: 'Order not found.' })
  }

  if (order.status !== 'failed') {
    throw createError({ statusCode: 409, message: 'Only failed orders can be retried.' })
  }

  // Get the last run's payload
  const [lastRun] = await db
    .select({
      runPayload: certOrderRuns.runPayload,
      runNumber: certOrderRuns.runNumber
    })
    .from(certOrderRuns)
    .where(eq(certOrderRuns.orderId, id))
    .orderBy(sql`${certOrderRuns.runNumber} desc`)
    .limit(1)

  if (!lastRun?.runPayload) {
    throw createError({ statusCode: 500, message: 'No previous run payload found.' })
  }

  const newRunId = createId()
  const newRunNumber = (lastRun.runNumber ?? 1) + 1

  // Update payload with new run ID
  const payload = JSON.parse(lastRun.runPayload)
  payload.runId = newRunId

  await db.transaction(async (tx) => {
    await tx
      .update(certOrders)
      .set({ status: 'pending' })
      .where(eq(certOrders.id, id))

    await tx.insert(certOrderRuns).values({
      id: newRunId,
      orderId: id,
      agentId: order.agentId,
      runPayload: JSON.stringify(payload),
      status: 'pending',
      runNumber: newRunNumber
    })
  })

  await logAuditEvent(event, 'CERT_ORDER_CREATED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_order',
    orderId: id,
    primaryDomain: order.primaryDomain,
    retry: true,
    runNumber: newRunNumber
  })

  return { ok: true, runId: newRunId, runNumber: newRunNumber }
})
