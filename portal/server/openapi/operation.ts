/**
 * Public Operation Definition
 *
 * Provides type-safe helpers for defining public API operations.
 * These definitions are used to generate the public OpenAPI spec.
 */

import type { z } from 'zod'
import type { OpenAPIV3 } from 'openapi-types'

// ============================================================================
// Types
// ============================================================================

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface OperationResponse {
  description: string
  schema?: z.ZodTypeAny
  headers?: Record<string, OpenAPIV3.HeaderObject>
}

export interface OperationDefinition {
  /**
   * Whether this operation is included in the public API spec.
   * Only operations with `public: true` are exposed externally.
   */
  public: boolean

  /**
   * Short summary of what the operation does.
   * Required for public operations.
   */
  summary: string

  /**
   * Detailed description of the operation.
   * Supports Markdown. Required for public operations.
   */
  description: string

  /**
   * Tags for grouping in OpenAPI docs.
   */
  tags: string[]

  /**
   * Security requirements for this operation.
   * Defaults to OrgApiToken for public operations.
   */
  security?: OpenAPIV3.SecurityRequirementObject[]

  /**
   * Required scopes for org API token authentication.
   * Required for public operations.
   * @example ['dns:read', 'dns:write']
   */
  'x-required-scopes'?: string[]

  /**
   * Resource constraints for this operation.
   * @example { allowedOrgIds: true, allowedZoneIds: true }
   */
  'x-resource-constraints'?: Record<string, boolean>

  /**
   * Path parameters schema (Zod).
   */
  params?: z.ZodTypeAny

  /**
   * Query parameters schema (Zod).
   */
  query?: z.ZodTypeAny

  /**
   * Request body schema (Zod).
   */
  body?: z.ZodTypeAny

  /**
   * Response schemas by status code.
   */
  responses: Record<string | number, OperationResponse>

  /**
   * Deprecation notice if this operation is deprecated.
   */
  deprecated?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Define a public API operation.
 * This helper provides type safety and documentation for operation metadata.
 *
 * @example
 * // In zones.get.openapi.ts
 * export default defineOperation({
 *   public: true,
 *   summary: 'List DNS zones',
 *   description: 'Returns all DNS zones the authenticated token has access to.',
 *   tags: ['dns'],
 *   'x-required-scopes': ['dns:read'],
 *   query: z.object({
 *     page: z.coerce.number().optional(),
 *     pageSize: z.coerce.number().optional(),
 *   }),
 *   responses: {
 *     200: {
 *       description: 'List of DNS zones',
 *       schema: DnsZoneListSchema,
 *     },
 *     401: { description: 'Unauthorized' },
 *     403: { description: 'Forbidden - insufficient scopes' },
 *     429: { description: 'Too many requests' },
 *   },
 * })
 */
export function defineOperation(definition: OperationDefinition): OperationDefinition {
  // Validate required fields for public operations
  if (definition.public) {
    if (!definition.summary) {
      throw new Error('Public operations must have a summary')
    }
    if (!definition.description) {
      throw new Error('Public operations must have a description')
    }
    if (!definition['x-required-scopes'] || definition['x-required-scopes'].length === 0) {
      throw new Error('Public operations must define x-required-scopes')
    }

    // Ensure standard error responses are documented
    const requiredResponses = ['401', '403', '429']
    for (const code of requiredResponses) {
      if (!definition.responses[code] && !definition.responses[Number(code)]) {
        console.warn(
          `Warning: Public operation missing response for ${code}. Consider adding it for completeness.`
        )
      }
    }

    // Default security for public operations
    if (!definition.security) {
      definition.security = [{ OrgApiToken: [] }]
    }
  }

  return definition
}

/**
 * Standard error responses for inclusion in operation definitions.
 */
export const standardResponses = {
  400: { description: 'Bad Request - Invalid input or validation error' },
  401: { description: 'Unauthorized - Missing or invalid authentication' },
  403: { description: 'Forbidden - Insufficient permissions or scope' },
  404: { description: 'Not Found - Resource does not exist' },
  409: { description: 'Conflict - Resource already exists or state conflict' },
  429: { description: 'Too Many Requests - Rate limit exceeded' },
  500: { description: 'Internal Server Error' },
} as const

/**
 * Helper to include standard responses in an operation.
 *
 * @example
 * responses: {
 *   200: { description: 'Success', schema: MySchema },
 *   ...includeStandardResponses(401, 403, 429),
 * }
 */
export function includeStandardResponses(
  ...codes: (keyof typeof standardResponses)[]
): Record<number, OperationResponse> {
  const result: Record<number, OperationResponse> = {}
  for (const code of codes) {
    result[code] = standardResponses[code]
  }
  return result
}

