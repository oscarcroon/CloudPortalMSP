import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { certAgents } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing agent ID.' })

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to delete agents.' })
    }
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(certAgents)
    .where(and(eq(certAgents.id, id), eq(certAgents.organizationId, orgId)))

  if (!existing) {
    throw createError({ statusCode: 404, message: 'Agent not found.' })
  }

  await db.delete(certAgents).where(eq(certAgents.id, id))

  await logAuditEvent(event, 'CERT_AGENT_DEACTIVATED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_agent',
    agentId: id,
    name: existing.name
  })

  return { ok: true }
})
