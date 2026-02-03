/**
 * Org API Token Authentication
 *
 * Middleware for authenticating requests using org API tokens (PAT).
 * Sets event.context.orgApiToken with token info if valid.
 */

import { createError, getRequestHeaders, H3Event } from 'h3'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { getDb } from '../../utils/db'
import { orgApiTokens } from '../../database/schema'
import { parseApiToken, verifyApiToken, looksLikeApiToken } from './tokenUtils'
import { logSecurityEvent } from '../../utils/audit'

// ============================================================================
// Types
// ============================================================================

export interface OrgApiTokenContext {
  /** Token ID (from database) */
  tokenId: string
  /** Organization ID this token belongs to */
  orgId: string
  /** Scopes granted to this token */
  scopes: string[]
  /** Resource constraints (if any) */
  constraints: Record<string, unknown> | null
  /** Token description */
  description: string | null
}

// Extend H3Event context type
declare module 'h3' {
  interface H3EventContext {
    orgApiToken?: OrgApiTokenContext | null
  }
}

// ============================================================================
// Token Lookup and Verification
// ============================================================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(event: H3Event): string | null {
  const headers = getRequestHeaders(event)
  const authHeader = headers.authorization || headers.Authorization

  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  return match[1] ?? null
}

/**
 * Try to authenticate with an org API token.
 * Returns null if no token found or token is not a PAT.
 * Throws error if token is invalid/expired/revoked.
 */
export async function tryOrgApiToken(event: H3Event): Promise<OrgApiTokenContext | null> {
  // Already checked?
  if (event.context.orgApiToken !== undefined) {
    return event.context.orgApiToken
  }

  // Extract bearer token
  const bearerToken = extractBearerToken(event)
  if (!bearerToken) {
    event.context.orgApiToken = null
    return null
  }

  // Only process API tokens (not JWTs)
  if (!looksLikeApiToken(bearerToken)) {
    event.context.orgApiToken = null
    return null
  }

  // Parse token
  const parsed = parseApiToken(bearerToken)
  if (!parsed) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'invalid_token_format',
      type: 'api_token',
    })
    throw createError({
      statusCode: 401,
      message: 'Invalid token format',
    })
  }

  // Lookup token by prefix
  const db = getDb()
  const now = new Date()

  const tokenRecord = db
    .select()
    .from(orgApiTokens)
    .where(
      and(
        eq(orgApiTokens.prefix, parsed.prefix),
        isNull(orgApiTokens.revokedAt)
      )
    )
    .get()

  if (!tokenRecord) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'token_not_found',
      type: 'api_token',
      prefix: parsed.prefix,
    })
    throw createError({
      statusCode: 401,
      message: 'Invalid or revoked token',
    })
  }

  // Check expiration
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < now) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'token_expired',
      type: 'api_token',
      tokenId: tokenRecord.id,
    })
    throw createError({
      statusCode: 401,
      message: 'Token has expired',
    })
  }

  // Verify hash
  const isValid = await verifyApiToken(
    parsed.secret,
    tokenRecord.tokenHash,
    tokenRecord.salt,
    tokenRecord.pepperKid
  )

  if (!isValid) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'invalid_token_secret',
      type: 'api_token',
      tokenId: tokenRecord.id,
    })
    throw createError({
      statusCode: 401,
      message: 'Invalid token',
    })
  }

  // Update last used timestamp (fire and forget)
  db.update(orgApiTokens)
    .set({ lastUsedAt: now })
    .where(eq(orgApiTokens.id, tokenRecord.id))
    .run()

  // Parse scopes and constraints
  let scopes: string[] = []
  let constraints: Record<string, unknown> | null = null

  try {
    scopes = JSON.parse(tokenRecord.scopes)
  } catch {
    scopes = []
  }

  if (tokenRecord.resourceConstraints) {
    try {
      constraints = JSON.parse(tokenRecord.resourceConstraints)
    } catch {
      constraints = null
    }
  }

  // Build context
  const tokenContext: OrgApiTokenContext = {
    tokenId: tokenRecord.id,
    orgId: tokenRecord.organizationId,
    scopes,
    constraints,
    description: tokenRecord.description,
  }

  event.context.orgApiToken = tokenContext
  return tokenContext
}

/**
 * Require a valid org API token.
 * Throws 401 if no valid token is found.
 */
export async function requireOrgApiToken(event: H3Event): Promise<OrgApiTokenContext> {
  const token = await tryOrgApiToken(event)

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'API token required',
    })
  }

  return token
}

/**
 * Require specific scopes on the token.
 * Throws 403 if token doesn't have all required scopes.
 */
export async function requireOrgApiScopes(
  event: H3Event,
  requiredScopes: string[]
): Promise<OrgApiTokenContext> {
  const token = await requireOrgApiToken(event)

  // Check if token has all required scopes
  const missingScopes = requiredScopes.filter((s) => !token.scopes.includes(s))

  if (missingScopes.length > 0) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'insufficient_scopes',
      type: 'api_token',
      tokenId: token.tokenId,
      requiredScopes,
      missingScopes,
    })
    throw createError({
      statusCode: 403,
      message: `Insufficient scopes. Missing: ${missingScopes.join(', ')}`,
    })
  }

  return token
}

/**
 * Require that token constraints allow access to a resource.
 * @param constraintCheck - Function to check if constraints allow access
 */
export async function requireOrgConstraint(
  event: H3Event,
  constraintCheck: (constraints: Record<string, unknown> | null, orgId: string) => boolean
): Promise<OrgApiTokenContext> {
  const token = await requireOrgApiToken(event)

  if (!constraintCheck(token.constraints, token.orgId)) {
    await logSecurityEvent(event, 'PERMISSION_DENIED', {
      reason: 'constraint_violation',
      type: 'api_token',
      tokenId: token.tokenId,
    })
    throw createError({
      statusCode: 403,
      message: 'Access denied by token constraints',
    })
  }

  return token
}

