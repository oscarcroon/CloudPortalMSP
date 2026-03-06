import { eq, and, sql } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { certCredentialSets, certOrders } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing credential set ID.' })

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to delete credential sets.' })
    }
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(certCredentialSets)
    .where(and(eq(certCredentialSets.id, id), eq(certCredentialSets.organizationId, orgId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Credential set not found.' })
  }

  // Check for active orders using this credential set
  const [orderCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(certOrders)
    .where(
      and(
        eq(certOrders.credentialSetId, id),
        eq(certOrders.organizationId, orgId)
      )
    )

  if (Number(orderCount?.count ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      message: 'Cannot delete credential set with existing orders. Deactivate it instead.'
    })
  }

  await db
    .delete(certCredentialSets)
    .where(eq(certCredentialSets.id, id))

  await logAuditEvent(event, 'CERT_CREDENTIAL_SET_DELETED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_credential_set',
    credentialSetId: id,
    name: existing.name
  })

  return { ok: true }
})
