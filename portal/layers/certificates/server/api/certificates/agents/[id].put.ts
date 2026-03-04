import { eq, and } from 'drizzle-orm'
import { readBody, getRouterParam } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { updateAgentSchema } from '../../../validation/schemas'
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
    if (!access.canManageAgents && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to manage agents.' })
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

  const body = await readBody(event)
  const parsed = updateAgentSchema.parse(body)

  const updates: Record<string, any> = {}

  if (parsed.name !== undefined) updates.name = parsed.name
  if (parsed.description !== undefined) updates.description = parsed.description
  if (parsed.tags !== undefined) updates.tags = JSON.stringify(parsed.tags)
  if (parsed.capabilities !== undefined) updates.capabilities = JSON.stringify(parsed.capabilities)
  if (parsed.status !== undefined) updates.status = parsed.status

  if (Object.keys(updates).length > 0) {
    await db.update(certAgents).set(updates).where(eq(certAgents.id, id))
  }

  const auditType = parsed.status === 'inactive' ? 'CERT_AGENT_DEACTIVATED' : 'CERT_AGENT_UPDATED'
  await logAuditEvent(event, auditType as any, {
    moduleKey: 'certificates',
    entityType: 'cert_agent',
    agentId: id,
    updates: Object.keys(updates)
  })

  return { ok: true }
})
