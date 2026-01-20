/**
 * OpenAPI metadata for GET /api/auth/me
 *
 * Example of a public operation definition.
 * This demonstrates the pattern for opt-in public API documentation.
 */

import { defineOperation, includeStandardResponses } from '../../openapi/operation'
import { z } from '../../openapi/zod'

// Response schema
const AuthMeResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    fullName: z.string().nullable(),
    status: z.string(),
    isSuperAdmin: z.boolean(),
    locale: z.string(),
  }),
  organizations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      role: z.string(),
    })
  ),
  currentOrgId: z.string().nullable(),
  currentTenantId: z.string().nullable(),
})

export default defineOperation({
  public: true,
  summary: 'Get current user session',
  description: `
Returns information about the currently authenticated user, including their organizations and current context.

This endpoint is useful for:
- Verifying authentication
- Getting user profile information
- Determining available organizations

**Note:** This endpoint returns different data depending on whether you use a Session JWT or Org API Token.
  `.trim(),
  tags: ['auth'],
  'x-required-scopes': ['user:read'],
  responses: {
    200: {
      description: 'Current user session information',
      schema: AuthMeResponseSchema,
    },
    ...includeStandardResponses(401, 403, 429),
  },
})

