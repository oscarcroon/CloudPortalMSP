import { eq, and, like, sql, desc } from 'drizzle-orm'
import { getQuery } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { listQuerySchema } from '../../../validation/schemas'
import { certOrders } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canView) {
      throw createError({ statusCode: 403, message: 'Missing permission to view orders.' })
    }
  }

  const query = listQuerySchema.parse(getQuery(event))
  const db = getDb()

  const conditions = [eq(certOrders.organizationId, orgId)]
  if (query.status) conditions.push(eq(certOrders.status, query.status as any))
  if (query.search) conditions.push(like(certOrders.primaryDomain, `%${query.search}%`))

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(certOrders)
    .where(where)

  const total = Number(countResult?.count ?? 0)
  const offset = (query.page - 1) * query.pageSize

  const rows = await db
    .select()
    .from(certOrders)
    .where(where)
    .orderBy(desc(certOrders.createdAt))
    .limit(query.pageSize)
    .offset(offset)

  return {
    orders: rows.map(row => ({
      ...row,
      subjectAlternativeNames: row.subjectAlternativeNames ? JSON.parse(row.subjectAlternativeNames) : [],
      validationMeta: row.validationMeta ? JSON.parse(row.validationMeta) : null,
      installationMeta: row.installationMeta ? JSON.parse(row.installationMeta) : null
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize)
    }
  }
})
