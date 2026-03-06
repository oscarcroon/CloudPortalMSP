/**
 * POST /api/certificates/agent-api/dns-challenge
 *
 * Single endpoint for DNS-01 challenge record management.
 * Auth: Run-scoped HMAC challenge token (Bearer header only).
 * Idempotent: create when exists → 200, delete when gone → 200.
 */

import { eq, and, gt } from 'drizzle-orm'
import { getHeader, readBody, createError } from 'h3'
import { getDb } from '~~/server/utils/db'
import { certOrderRuns } from '~~/server/database/schema'
import { validateDnsChallengeToken } from '../../../lib/certificates/dns-challenge-token'
import { dnsChallengeSchema } from '../../../validation/schemas'
import {
  getDnsChallengeProvider,
  isRecordInZone,
  getRelativeRecordName
} from '../../../../../_shared/dns-challenge-providers'

export default defineEventHandler(async (event) => {
  // 1. Extract Bearer token from Authorization header
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or invalid Authorization header' })
  }
  const token = authHeader.slice(7)

  // 2. Validate HMAC token
  const payload = validateDnsChallengeToken(token)
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired challenge token' })
  }

  // 3. Verify lease is still active in DB
  const db = getDb()
  const [activeRun] = await db
    .select({ id: certOrderRuns.id })
    .from(certOrderRuns)
    .where(
      and(
        eq(certOrderRuns.id, payload.runId),
        eq(certOrderRuns.leaseId, payload.leaseId),
        gt(certOrderRuns.leasedUntil, new Date())
      )
    )
    .limit(1)

  if (!activeRun) {
    throw createError({ statusCode: 403, statusMessage: 'Lease expired or invalid' })
  }

  // 4. Look up provider
  const provider = getDnsChallengeProvider(payload.provider)
  if (!provider) {
    throw createError({
      statusCode: 503,
      statusMessage: `DNS provider "${payload.provider}" not available (layer may be unloaded)`
    })
  }

  // 5. Resolve zoneName from provider (source of truth)
  const zoneName = await provider.getZoneName(payload.orgId, payload.zoneId)
  if (!zoneName) {
    throw createError({
      statusCode: 404,
      statusMessage: `Zone ${payload.zoneId} not found in provider "${payload.provider}"`
    })
  }

  // 6. Parse and validate request body
  const body = await readBody(event)
  const { action, recordName, challengeValue } = dnsChallengeSchema.parse(body)

  // 7. Guardrail: record must belong to the zone
  if (!isRecordInZone(recordName, zoneName)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Record "${recordName}" does not belong to zone "${zoneName}"`
    })
  }

  // 8. Normalize to zone-relative name
  const relativeName = getRelativeRecordName(recordName, zoneName)

  // 9. Execute action (both are idempotent)
  if (action === 'create') {
    await provider.createTxt(payload.orgId, payload.zoneId, relativeName, challengeValue)
  } else {
    await provider.deleteTxt(payload.orgId, payload.zoneId, relativeName, challengeValue)
  }

  return { ok: true }
})
