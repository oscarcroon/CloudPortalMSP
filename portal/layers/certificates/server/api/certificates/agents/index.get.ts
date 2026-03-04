import { eq } from 'drizzle-orm'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { certAgents } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canView) {
      throw createError({ statusCode: 403, message: 'Missing permission to view agents.' })
    }
  }

  const db = getDb()
  const rows = await db
    .select({
      id: certAgents.id,
      name: certAgents.name,
      description: certAgents.description,
      tags: certAgents.tags,
      capabilities: certAgents.capabilities,
      status: certAgents.status,
      lastHeartbeatAt: certAgents.lastHeartbeatAt,
      lastSeenIp: certAgents.lastSeenIp,
      heartbeatMeta: certAgents.heartbeatMeta,
      createdAt: certAgents.createdAt,
      updatedAt: certAgents.updatedAt
    })
    .from(certAgents)
    .where(eq(certAgents.organizationId, orgId))
    .orderBy(certAgents.createdAt)

  return {
    agents: rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : { supports: [], dnsProviders: [] },
      heartbeatMeta: row.heartbeatMeta ? JSON.parse(row.heartbeatMeta) : null
    }))
  }
})
