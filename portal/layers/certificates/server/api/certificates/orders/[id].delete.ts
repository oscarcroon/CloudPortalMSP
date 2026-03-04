import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
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
      throw createError({ statusCode: 403, message: 'Missing permission to cancel orders.' })
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

  if (['completed', 'cancelled'].includes(order.status)) {
    throw createError({ statusCode: 409, message: `Cannot cancel an order with status: ${order.status}` })
  }

  // Cancel order and any pending runs
  await db.transaction(async (tx) => {
    await tx
      .update(certOrders)
      .set({ status: 'cancelled' })
      .where(eq(certOrders.id, id))

    await tx
      .update(certOrderRuns)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(certOrderRuns.orderId, id),
          eq(certOrderRuns.status, 'pending')
        )
      )
  })

  await logAuditEvent(event, 'CERT_ORDER_CANCELLED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_order',
    orderId: id,
    primaryDomain: order.primaryDomain
  })

  return { ok: true }
})
