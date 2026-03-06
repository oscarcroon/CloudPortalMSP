import { eq, and, desc } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { certOrders, certOrderRuns } from '~~/server/database/schema'

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
    if (!access.canView) {
      throw createError({ statusCode: 403, message: 'Missing permission to view orders.' })
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

  // Get all runs for this order
  const runs = await db
    .select({
      id: certOrderRuns.id,
      status: certOrderRuns.status,
      runNumber: certOrderRuns.runNumber,
      logs: certOrderRuns.logs,
      errorMessage: certOrderRuns.errorMessage,
      errorCode: certOrderRuns.errorCode,
      resultMeta: certOrderRuns.resultMeta,
      startedAt: certOrderRuns.startedAt,
      completedAt: certOrderRuns.completedAt,
      createdAt: certOrderRuns.createdAt
    })
    .from(certOrderRuns)
    .where(eq(certOrderRuns.orderId, id))
    .orderBy(desc(certOrderRuns.runNumber))

  return {
    order: {
      ...order,
      subjectAlternativeNames: order.subjectAlternativeNames ? JSON.parse(order.subjectAlternativeNames) : [],
      validationMeta: order.validationMeta ? JSON.parse(order.validationMeta) : null,
      installationMeta: order.installationMeta ? JSON.parse(order.installationMeta) : null
    },
    runs: runs.map(run => ({
      ...run,
      resultMeta: run.resultMeta ? JSON.parse(run.resultMeta) : null
    }))
  }
})
