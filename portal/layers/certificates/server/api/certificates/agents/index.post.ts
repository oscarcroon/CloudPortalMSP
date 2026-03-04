import { readBody } from 'h3'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { registerAgentSchema } from '../../../validation/schemas'
import { createAgentToken } from '~~/layers/_shared/agent-token-utils'
import { certAgents } from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canManageAgents && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to register agents.' })
    }
  }

  const body = await readBody(event)
  const parsed = registerAgentSchema.parse(body)

  // Generate agent token
  const token = await createAgentToken()

  const db = getDb()
  const [inserted] = await db
    .insert(certAgents)
    .values({
      organizationId: orgId,
      name: parsed.name,
      description: parsed.description ?? null,
      tokenPrefix: token.prefix,
      tokenHash: token.tokenHash,
      tokenSalt: token.salt,
      tokenHashAlg: token.hashAlg,
      tokenPepperKid: token.pepperKid,
      tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
      capabilities: parsed.capabilities ? JSON.stringify(parsed.capabilities) : null,
      status: 'active',
      createdByUserId: auth.user.id
    })
    .$returningId()

  await logAuditEvent(event, 'CERT_AGENT_REGISTERED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_agent',
    agentId: inserted.id,
    name: parsed.name
  })

  return {
    ok: true,
    id: inserted.id,
    token: token.plaintext // Only shown once
  }
})
