/**
 * GET /api/organizations/:orgId/api-tokens
 *
 * List all API tokens for an organization.
 * Requires org owner or admin role.
 */
import { defineEventHandler, getRouterParams, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission } from '../../../../utils/rbac'
import { getDb } from '../../../../utils/db'
import { orgApiTokens, users } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const { orgId } = getRouterParams(event)

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  // Require org:manage permission (owner or admin role)
  await requirePermission(event, 'org:manage', orgId)

  const db = getDb()

  // Get all tokens for the organization (not revoked)
  const tokens = db
    .select({
      id: orgApiTokens.id,
      prefix: orgApiTokens.prefix,
      description: orgApiTokens.description,
      scopes: orgApiTokens.scopes,
      resourceConstraints: orgApiTokens.resourceConstraints,
      createdByUserId: orgApiTokens.createdByUserId,
      createdByUserEmail: users.email,
      createdByUserName: users.fullName,
      expiresAt: orgApiTokens.expiresAt,
      revokedAt: orgApiTokens.revokedAt,
      lastUsedAt: orgApiTokens.lastUsedAt,
      createdAt: orgApiTokens.createdAt,
    })
    .from(orgApiTokens)
    .leftJoin(users, eq(users.id, orgApiTokens.createdByUserId))
    .where(eq(orgApiTokens.organizationId, orgId))
    .orderBy(orgApiTokens.createdAt)

  // Parse scopes and constraints
  const formattedTokens = tokens.map((token) => {
    let scopes: string[] = []
    let constraints: Record<string, unknown> | null = null

    try {
      scopes = JSON.parse(token.scopes)
    } catch {
      scopes = []
    }

    if (token.resourceConstraints) {
      try {
        constraints = JSON.parse(token.resourceConstraints)
      } catch {
        constraints = null
      }
    }

    return {
      id: token.id,
      prefix: token.prefix,
      description: token.description,
      scopes,
      resourceConstraints: constraints,
      createdBy: {
        userId: token.createdByUserId,
        email: token.createdByUserEmail,
        name: token.createdByUserName,
      },
      expiresAt: token.expiresAt?.getTime() ?? null,
      revokedAt: token.revokedAt?.getTime() ?? null,
      lastUsedAt: token.lastUsedAt?.getTime() ?? null,
      createdAt: token.createdAt.getTime(),
      status: token.revokedAt ? 'revoked' : token.expiresAt && token.expiresAt < new Date() ? 'expired' : 'active',
    }
  })

  return {
    tokens: formattedTokens,
    total: formattedTokens.length,
  }
})

