import { eq } from 'drizzle-orm'
import { readBody, getHeader } from 'h3'
import { requireAgentAuth } from '../../../lib/certificates/agent-auth'
import { agentHeartbeatSchema } from '../../../validation/schemas'
import { getDb } from '~~/server/utils/db'
import { certAgents } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const agent = await requireAgentAuth(event)

  const body = await readBody(event)
  const parsed = agentHeartbeatSchema.parse(body ?? {})

  const db = getDb()

  // Extract client IP
  const forwarded = getHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim()
    || getHeader(event, 'x-real-ip')
    || ''

  await db
    .update(certAgents)
    .set({
      lastHeartbeatAt: new Date(),
      lastSeenIp: ip.slice(0, 50) || null,
      heartbeatMeta: Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : null,
      capabilities: body?.capabilities ? JSON.stringify(body.capabilities) : undefined
    })
    .where(eq(certAgents.id, agent.agentId))

  return { ok: true }
})
