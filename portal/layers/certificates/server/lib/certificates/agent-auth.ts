/**
 * Agent Authentication Middleware
 *
 * Validates agent Bearer tokens against cert_agents table.
 * Used by /api/certificates/agent-api/ endpoints.
 */

import { createError, getHeader, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { parseAgentToken, verifyAgentToken } from '../../../../_shared/agent-token-utils'
import { getDb } from '../../../../../server/utils/db'
import { certAgents } from '../../../../../server/database/schema'

export interface AuthenticatedAgent {
  agentId: string
  organizationId: string
  name: string
  status: string
  capabilities: string | null
}

/**
 * Extract and verify agent token from the request.
 * Returns the authenticated agent record or throws 401/403.
 */
export async function requireAgentAuth(event: H3Event): Promise<AuthenticatedAgent> {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.slice(7)
  const parsed = parseAgentToken(token)
  if (!parsed) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid agent token format' })
  }

  const db = getDb()

  // Look up agent by token prefix
  const [agent] = await db
    .select()
    .from(certAgents)
    .where(eq(certAgents.tokenPrefix, parsed.prefix))

  if (!agent) {
    throw createError({ statusCode: 401, statusMessage: 'Agent not found' })
  }

  if (agent.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Agent is inactive' })
  }

  // Verify token hash
  const valid = await verifyAgentToken(
    parsed.secret,
    agent.tokenHash,
    agent.tokenSalt,
    agent.tokenPepperKid
  )

  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid agent token' })
  }

  return {
    agentId: agent.id,
    organizationId: agent.organizationId,
    name: agent.name,
    status: agent.status,
    capabilities: agent.capabilities
  }
}
