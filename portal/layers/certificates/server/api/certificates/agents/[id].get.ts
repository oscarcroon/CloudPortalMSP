import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
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
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing agent ID.' })

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canView && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to view agents.' })
    }
  }

  const db = getDb()
  const [agent] = await db
    .select()
    .from(certAgents)
    .where(and(eq(certAgents.id, id), eq(certAgents.organizationId, orgId)))

  if (!agent) {
    throw createError({ statusCode: 404, message: 'Agent not found.' })
  }

  return {
    agent: {
      ...agent,
      tags: agent.tags ? JSON.parse(agent.tags as string) : null,
      capabilities: agent.capabilities ? JSON.parse(agent.capabilities as string) : null,
      heartbeatMeta: agent.heartbeatMeta ? JSON.parse(agent.heartbeatMeta as string) : null
    }
  }
})
