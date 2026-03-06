import { eq, and, sql, gte } from 'drizzle-orm'
import { readBody } from 'h3'
import { createId } from '@paralleldrive/cuid2'
import { ensureAuthState } from '~~/server/utils/session'
import { getDb } from '~~/server/utils/db'
import { getCertificatesModuleAccessForUser } from '../../../lib/certificates/access'
import { createOrderSchema } from '../../../validation/schemas'
import { validateDomainOwnership } from '../../../lib/certificates/domain-ownership'
import { decryptSecret } from '../../../lib/certificates/crypto'
import { RATE_LIMITS } from '../../../lib/certificates/types'
import type { RunPayload } from '../../../lib/certificates/types'
import {
  certOrders,
  certOrderRuns,
  certCredentialSets,
  certAgents
} from '~~/server/database/schema'
import { logAuditEvent } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = await ensureAuthState(event)
  if (!auth?.currentOrgId) {
    throw createError({ statusCode: 400, message: 'Organisation saknas i sessionen.' })
  }
  const orgId = auth.currentOrgId

  if (!auth.user.isSuperAdmin) {
    const access = await getCertificatesModuleAccessForUser(orgId, auth.user.id)
    if (!access.canOrder && !access.canAdmin) {
      throw createError({ statusCode: 403, message: 'Missing permission to create orders.' })
    }
  }

  const body = await readBody(event)
  const parsed = createOrderSchema.parse(body)
  const db = getDb()

  // Idempotency check
  if (parsed.idempotencyKey) {
    const [existing] = await db
      .select({ id: certOrders.id, status: certOrders.status })
      .from(certOrders)
      .where(
        and(
          eq(certOrders.organizationId, orgId),
          eq(certOrders.idempotencyKey, parsed.idempotencyKey)
        )
      )
    if (existing) {
      return { ok: true, id: existing.id, status: existing.status, idempotent: true }
    }
  }

  // Rate limiting
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [hourCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(certOrders)
    .where(
      and(
        eq(certOrders.organizationId, orgId),
        gte(certOrders.createdAt, oneHourAgo)
      )
    )

  if (Number(hourCount?.count ?? 0) >= RATE_LIMITS.ORDERS_PER_HOUR) {
    throw createError({ statusCode: 429, message: `Rate limit exceeded: max ${RATE_LIMITS.ORDERS_PER_HOUR} orders per hour.` })
  }

  const [dayCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(certOrders)
    .where(
      and(
        eq(certOrders.organizationId, orgId),
        gte(certOrders.createdAt, oneDayAgo)
      )
    )

  if (Number(dayCount?.count ?? 0) >= RATE_LIMITS.ORDERS_PER_DAY) {
    throw createError({ statusCode: 429, message: `Rate limit exceeded: max ${RATE_LIMITS.ORDERS_PER_DAY} orders per day.` })
  }

  // Validate credential set
  const [credentialSet] = await db
    .select()
    .from(certCredentialSets)
    .where(
      and(
        eq(certCredentialSets.id, parsed.credentialSetId),
        eq(certCredentialSets.organizationId, orgId),
        eq(certCredentialSets.isActive, true)
      )
    )

  if (!credentialSet) {
    throw createError({ statusCode: 400, message: 'Credential set not found or inactive.' })
  }

  // Validate agent
  const [agent] = await db
    .select()
    .from(certAgents)
    .where(
      and(
        eq(certAgents.id, parsed.agentId),
        eq(certAgents.organizationId, orgId),
        eq(certAgents.status, 'active')
      )
    )

  if (!agent) {
    throw createError({ statusCode: 400, message: 'Agent not found or inactive.' })
  }

  // Validate domain ownership
  const domainCheck = await validateDomainOwnership(
    orgId,
    parsed.primaryDomain,
    parsed.subjectAlternativeNames
  )

  if (!domainCheck.valid) {
    await logAuditEvent(event, 'CERT_ORDER_DOMAIN_REJECTED' as any, {
      moduleKey: 'certificates',
      entityType: 'cert_order',
      primaryDomain: parsed.primaryDomain,
      errors: domainCheck.errors
    })
    throw createError({
      statusCode: 403,
      message: `Domain ownership validation failed: ${domainCheck.errors.join('; ')}`
    })
  }

  // Build renewal name
  const orderId = createId()
  const orgShort = orgId.slice(0, 6)
  const orderShort = orderId.slice(0, 6)
  const renewalName = `${orgShort}-${orderShort}-${parsed.primaryDomain}`

  // Decrypt EAB HMAC for the run payload
  let eabHmac: string | undefined
  if (credentialSet.encryptedEabHmac && credentialSet.encryptionIv && credentialSet.encryptionAuthTag) {
    eabHmac = decryptSecret({
      cipherText: credentialSet.encryptedEabHmac,
      iv: credentialSet.encryptionIv,
      authTag: credentialSet.encryptionAuthTag
    })
  }

  // Build immutable run payload
  const runId = createId()
  const runPayload: RunPayload = {
    runId,
    orderId,
    primaryDomain: parsed.primaryDomain,
    subjectAlternativeNames: parsed.subjectAlternativeNames,
    validationMethod: parsed.validationMethod,
    validationMeta: parsed.validationMeta,
    installationTarget: parsed.installationTarget,
    installationMeta: parsed.installationMeta,
    autoRenew: parsed.autoRenew,
    renewalName,
    renewDaysBefore: parsed.renewDaysBefore,
    credential: {
      provider: credentialSet.provider,
      acmeDirectoryUrl: credentialSet.acmeDirectoryUrl,
      eabKid: credentialSet.eabKid ?? undefined,
      eabHmac
    }
  }

  // Create order + first run in transaction
  await db.transaction(async (tx) => {
    await tx.insert(certOrders).values({
      id: orderId,
      organizationId: orgId,
      credentialSetId: parsed.credentialSetId,
      agentId: parsed.agentId,
      primaryDomain: parsed.primaryDomain,
      subjectAlternativeNames: JSON.stringify(parsed.subjectAlternativeNames),
      validationMethod: parsed.validationMethod,
      validationMeta: parsed.validationMeta ? JSON.stringify(parsed.validationMeta) : null,
      installationTarget: parsed.installationTarget,
      installationMeta: parsed.installationMeta ? JSON.stringify(parsed.installationMeta) : null,
      status: 'pending',
      idempotencyKey: parsed.idempotencyKey ?? null,
      autoRenew: parsed.autoRenew,
      renewalName,
      renewDaysBefore: parsed.renewDaysBefore,
      createdByUserId: auth.user.id
    })

    await tx.insert(certOrderRuns).values({
      id: runId,
      orderId,
      agentId: parsed.agentId,
      runPayload: JSON.stringify(runPayload),
      status: 'pending',
      runNumber: 1
    })
  })

  await logAuditEvent(event, 'CERT_ORDER_CREATED' as any, {
    moduleKey: 'certificates',
    entityType: 'cert_order',
    orderId,
    primaryDomain: parsed.primaryDomain,
    validationMethod: parsed.validationMethod,
    installationTarget: parsed.installationTarget
  })

  return { ok: true, id: orderId, runId }
})
