/**
 * POST /api/organizations/:orgId/api-tokens/:tokenId/revoke
 *
 * Revoke an API token.
 * Requires org owner or admin role.
 */
import { defineEventHandler, getRouterParams, createError } from 'h3'
import { eq, and } from 'drizzle-orm'
import { requirePermission } from '../../../../../utils/rbac'
import { getDb } from '../../../../../utils/db'
import { orgApiTokens } from '../../../../../database/schema'
import { logAuditEvent } from '../../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const { orgId, tokenId } = getRouterParams(event)

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  if (!tokenId) {
    throw createError({ statusCode: 400, message: 'Token ID required' })
  }

  // Require org:manage permission (owner or admin role)
  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  // Find the token
  const token = db
    .select()
    .from(orgApiTokens)
    .where(
      and(
        eq(orgApiTokens.id, tokenId),
        eq(orgApiTokens.organizationId, orgId)
      )
    )
    .get()

  if (!token) {
    throw createError({
      statusCode: 404,
      message: 'Token not found',
    })
  }

  if (token.revokedAt) {
    throw createError({
      statusCode: 409,
      message: 'Token is already revoked',
    })
  }

  // Revoke the token
  const now = new Date()

  await db.update(orgApiTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(orgApiTokens.id, tokenId))

  // Audit log
  await logAuditEvent(event, 'API_TOKEN_REVOKED', {
    tokenId,
    prefix: token.prefix,
  })

  return {
    success: true,
    message: 'Token revoked successfully',
    tokenId,
    revokedAt: now.getTime(),
  }
})

