import { eq, and, sql, lte, gte } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../lib/certificates/access'
import {
  certCertificates,
  certOrders,
  certAgents
} from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canView) {
      throw createError({ statusCode: 403, message: 'Missing permission to view certificates.' })
    }
  }

  const db = getDb()
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

  // Cert counts
  const [certCounts] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${certCertificates.status} = 'active' then 1 else 0 end)`,
      expiring: sql<number>`sum(case when ${certCertificates.status} = 'expiring' then 1 else 0 end)`,
      expired: sql<number>`sum(case when ${certCertificates.status} = 'expired' then 1 else 0 end)`
    })
    .from(certCertificates)
    .where(eq(certCertificates.organizationId, orgId))

  // Order counts
  const [orderCounts] = await db
    .select({
      pending: sql<number>`sum(case when ${certOrders.status} in ('pending', 'queued', 'processing') then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${certOrders.status} = 'failed' then 1 else 0 end)`
    })
    .from(certOrders)
    .where(eq(certOrders.organizationId, orgId))

  // Agent counts
  const [agentCounts] = await db
    .select({
      total: sql<number>`count(*)`,
      online: sql<number>`sum(case when ${certAgents.status} = 'active' and ${certAgents.lastHeartbeatAt} >= ${fiveMinutesAgo} then 1 else 0 end)`
    })
    .from(certAgents)
    .where(eq(certAgents.organizationId, orgId))

  // Recent orders (last 10)
  const recentOrders = await db
    .select({
      id: certOrders.id,
      primaryDomain: certOrders.primaryDomain,
      status: certOrders.status,
      validationMethod: certOrders.validationMethod,
      createdAt: certOrders.createdAt
    })
    .from(certOrders)
    .where(eq(certOrders.organizationId, orgId))
    .orderBy(sql`${certOrders.createdAt} desc`)
    .limit(10)

  // Expiring certificates (next 30 days)
  const expiringCerts = await db
    .select({
      id: certCertificates.id,
      primaryDomain: certCertificates.primaryDomain,
      expiresAt: certCertificates.expiresAt,
      issuer: certCertificates.issuer,
      status: certCertificates.status
    })
    .from(certCertificates)
    .where(
      and(
        eq(certCertificates.organizationId, orgId),
        lte(certCertificates.expiresAt, thirtyDaysFromNow),
        gte(certCertificates.expiresAt, now)
      )
    )
    .orderBy(certCertificates.expiresAt)
    .limit(10)

  return {
    summary: {
      totalCertificates: Number(certCounts?.total ?? 0),
      activeCertificates: Number(certCounts?.active ?? 0),
      expiringCertificates: Number(certCounts?.expiring ?? 0),
      expiredCertificates: Number(certCounts?.expired ?? 0),
      pendingOrders: Number(orderCounts?.pending ?? 0),
      failedOrders: Number(orderCounts?.failed ?? 0),
      agentsOnline: Number(agentCounts?.online ?? 0),
      agentsTotal: Number(agentCounts?.total ?? 0)
    },
    recentOrders,
    expiringCerts
  }
})
