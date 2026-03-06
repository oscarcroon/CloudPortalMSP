/**
 * POST /api/organizations/:orgId/api-tokens
 *
 * Create a new API token for an organization.
 * Requires org owner or admin role.
 *
 * IMPORTANT: The plaintext token is only returned once in this response.
 * It cannot be retrieved later.
 */
import { defineEventHandler, getRouterParams, readBody, createError } from 'h3'
import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
import { requirePermission } from '../../../../utils/rbac'
import { getDb } from '../../../../utils/db'
import { orgApiTokens } from '../../../../database/schema'
import { createApiToken, validateScopes } from '../../../../security/apiTokens'
import { logAuditEvent } from '../../../../utils/audit'

// Request schema
const createTokenSchema = z.object({
  description: z.string().max(512).optional(),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  resourceConstraints: z.record(z.unknown()).optional(),
  expiresAt: z.number().optional(), // Unix timestamp in ms
})

export default defineEventHandler(async (event) => {
  const { orgId } = getRouterParams(event)

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'Organization ID required' })
  }

  // Require org:manage permission (owner or admin role)
  const { auth } = await requirePermission(event, 'org:manage', orgId)

  // Parse and validate body
  const body = await readBody(event)
  const parsed = createTokenSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: parsed.error.errors[0]?.message || 'Invalid request body',
    })
  }

  const { description, scopes, resourceConstraints, expiresAt } = parsed.data

  // Validate scopes against known scope registry
  const scopeValidation = validateScopes(scopes)
  if (!scopeValidation.valid) {
    throw createError({ statusCode: 400, message: `Unknown scopes: ${scopeValidation.unknown.join(', ')}` })
  }

  // Create the token
  const tokenResult = await createApiToken()

  const db = getDb()

  // Insert into database
  const tokenId = createId()
  const now = new Date()

  await db.insert(orgApiTokens)
    .values({
      id: tokenId,
      organizationId: orgId,
      prefix: tokenResult.prefix,
      hashAlg: tokenResult.hashAlg,
      hashVersion: tokenResult.hashVersion,
      hashParams: tokenResult.hashParams,
      salt: tokenResult.salt,
      tokenHash: tokenResult.tokenHash,
      pepperKid: tokenResult.pepperKid,
      scopes: JSON.stringify(scopes),
      resourceConstraints: resourceConstraints ? JSON.stringify(resourceConstraints) : null,
      description: description || null,
      createdByUserId: auth.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: now,
      updatedAt: now,
    })

  // Audit log
  await logAuditEvent(event, 'API_TOKEN_CREATED', {
    tokenId,
    prefix: tokenResult.prefix,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  })

  // Return the token (plaintext shown only once)
  return {
    id: tokenId,
    token: tokenResult.plaintext,
    prefix: tokenResult.prefix,
    description,
    scopes,
    resourceConstraints: resourceConstraints || null,
    expiresAt: expiresAt || null,
    createdAt: now.getTime(),
    message: 'Token created successfully. Save this token now - it will not be shown again.',
  }
})

