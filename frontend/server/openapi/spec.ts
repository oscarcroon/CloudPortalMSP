/**
 * OpenAPI Spec Builder
 *
 * Builds OpenAPI 3.0 specification from generated route inventory.
 * Supports two modes:
 * - 'internal': All routes for dev/QA (requires session auth)
 * - 'public': Opt-in routes for external consumers (requires org token)
 */

import type { OpenAPIV3 } from 'openapi-types'
import { internalRoutes, type InternalRouteDefinition } from './generated/routes.internal.generated'
import { publicOperations, type PublicOperationMeta } from './generated/operations.public.generated'

// ============================================================================
// Types
// ============================================================================

export interface BuildOpenApiOptions {
  /** Mode determines which routes are included and default security */
  mode: 'internal' | 'public'
  /** Base URL for servers (defaults to relative) */
  serverUrl?: string
  /** API version for info.version */
  version?: string
}

// ============================================================================
// Constants
// ============================================================================

const API_TITLE = 'CloudMSP API'
const API_DESCRIPTION = `
CloudMSP Portal API provides programmatic access to manage organizations, users, DNS zones, and more.

## Authentication

This API supports two authentication methods:

### Session JWT (for Swagger UI / browser)
Use your existing session token from the portal. In Swagger UI, use the "Authorize" button and enter your JWT.

### Org API Token (for external integrations)
Create a Personal Access Token (PAT) in your organization settings. Use it with:
\`\`\`
Authorization: Bearer msp_pat.<prefix>.<secret>
\`\`\`

## Rate Limiting

API requests are rate-limited per token and per organization. When limits are exceeded, you'll receive a 429 response with a \`Retry-After\` header.

## Errors

All errors follow a consistent format:
\`\`\`json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "data": { /* optional additional context */ }
}
\`\`\`
`.trim()

// ============================================================================
// Security Schemes
// ============================================================================

const securitySchemes: Record<string, OpenAPIV3.SecuritySchemeObject> = {
  SessionJWT: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'Session JWT token. Can be obtained by logging into the portal or via the /api/auth/login endpoint.',
  },
  OrgApiToken: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Opaque',
    description:
      'Organization API Token (PAT). Created by org admins in the portal. Format: msp_pat.<prefix>.<secret>',
  },
}

// ============================================================================
// Standard Response Schemas
// ============================================================================

const errorResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['statusCode', 'message'],
  properties: {
    statusCode: {
      type: 'integer',
      description: 'HTTP status code',
      example: 400,
    },
    message: {
      type: 'string',
      description: 'Human-readable error message',
      example: 'Invalid request body',
    },
    data: {
      type: 'object',
      description: 'Optional additional error context',
      additionalProperties: true,
    },
  },
}

const standardResponses: Record<string, OpenAPIV3.ResponseObject> = {
  BadRequest: {
    description: 'Bad Request - Invalid input or validation error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  Unauthorized: {
    description: 'Unauthorized - Missing or invalid authentication',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  Forbidden: {
    description: 'Forbidden - Insufficient permissions or scope',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  NotFound: {
    description: 'Not Found - Resource does not exist',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  TooManyRequests: {
    description: 'Too Many Requests - Rate limit exceeded',
    headers: {
      'Retry-After': {
        description: 'Seconds to wait before retrying',
        schema: { type: 'integer' },
      },
    },
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  InternalServerError: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert route path to OpenAPI parameters
 */
function extractPathParameters(path: string): OpenAPIV3.ParameterObject[] {
  const params: OpenAPIV3.ParameterObject[] = []
  const matches = path.matchAll(/\{([^}]+)\}/g)

  for (const match of matches) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: `The ${match[1]} parameter`,
    })
  }

  return params
}

/**
 * Build operation object from route definition
 */
function buildOperation(
  route: InternalRouteDefinition,
  mode: 'internal' | 'public'
): OpenAPIV3.OperationObject {
  const pathParams = extractPathParameters(route.path)

  // Default security based on mode
  const security: OpenAPIV3.SecurityRequirementObject[] =
    mode === 'internal' ? [{ SessionJWT: [] }] : [{ OrgApiToken: [] }]

  const operation: OpenAPIV3.OperationObject = {
    operationId: route.operationId,
    tags: route.tags,
    summary: `${route.method.toUpperCase()} ${route.path}`,
    description: `Handler: \`${route.fileRef}\``,
    security,
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': { $ref: '#/components/responses/Forbidden' },
      '500': { $ref: '#/components/responses/InternalServerError' },
    },
  }

  // Add path parameters if any
  if (pathParams.length > 0) {
    operation.parameters = pathParams
  }

  // Add request body for methods that typically have one
  if (['post', 'put', 'patch'].includes(route.method)) {
    operation.requestBody = {
      description: 'Request body',
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: true },
        },
      },
    }
  }

  return operation
}

/**
 * Group routes into OpenAPI paths object
 */
function buildPaths(
  routes: InternalRouteDefinition[],
  mode: 'internal' | 'public'
): OpenAPIV3.PathsObject {
  const paths: OpenAPIV3.PathsObject = {}

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {}
    }

    const pathItem = paths[route.path] as OpenAPIV3.PathItemObject
    pathItem[route.method] = buildOperation(route, mode)
  }

  return paths
}

/**
 * Build tag objects with descriptions
 */
function buildTags(routes: InternalRouteDefinition[]): OpenAPIV3.TagObject[] {
  const tagSet = new Set<string>()
  for (const route of routes) {
    for (const tag of route.tags) {
      tagSet.add(tag)
    }
  }

  const tagDescriptions: Record<string, string> = {
    admin: 'Administrative endpoints for system management',
    auth: 'Authentication and session management',
    organizations: 'Organization management',
    profile: 'User profile management',
    settings: 'User and organization settings',
    modules: 'Module configuration and permissions',
    invite: 'Invitation management',
    branding: 'Branding and theming',
    dns: 'DNS zone and record management',
    'cloudflare-dns': 'Cloudflare DNS integration',
    'windows-dns': 'Windows DNS integration',
  }

  return [...tagSet].sort().map((tag) => ({
    name: tag,
    description: tagDescriptions[tag] || `Operations related to ${tag}`,
  }))
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Build public operation into OpenAPI operation object
 */
function buildPublicOperation(op: PublicOperationMeta): OpenAPIV3.OperationObject {
  const pathParams = extractPathParameters(op.path)

  const operation: OpenAPIV3.OperationObject = {
    operationId: op.operationId,
    tags: op.tags,
    summary: op.summary,
    description: op.description,
    security: [{ OrgApiToken: [] }],
    deprecated: op.deprecated,
    'x-required-scopes': op.requiredScopes,
    responses: {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { type: 'object', additionalProperties: true },
          },
        },
      },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': { $ref: '#/components/responses/Forbidden' },
      '429': { $ref: '#/components/responses/TooManyRequests' },
      '500': { $ref: '#/components/responses/InternalServerError' },
    },
  } as OpenAPIV3.OperationObject

  // Add resource constraints if defined
  if (op.resourceConstraints) {
    (operation as any)['x-resource-constraints'] = op.resourceConstraints
  }

  // Add path parameters if any
  if (pathParams.length > 0) {
    operation.parameters = pathParams
  }

  // Add request body for methods that typically have one
  if (['post', 'put', 'patch'].includes(op.method)) {
    operation.requestBody = {
      description: 'Request body',
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: true },
        },
      },
    }
  }

  return operation
}

/**
 * Build tag objects from public operations
 */
function buildPublicTags(operations: PublicOperationMeta[]): OpenAPIV3.TagObject[] {
  const tagSet = new Set<string>()
  for (const op of operations) {
    for (const tag of op.tags) {
      tagSet.add(tag)
    }
  }

  const tagDescriptions: Record<string, string> = {
    dns: 'DNS zone and record management',
    organizations: 'Organization management',
    users: 'User management',
  }

  return [...tagSet].sort().map((tag) => ({
    name: tag,
    description: tagDescriptions[tag] || `Operations related to ${tag}`,
  }))
}

/**
 * Build paths from public operations
 */
function buildPublicPaths(operations: PublicOperationMeta[]): OpenAPIV3.PathsObject {
  const paths: OpenAPIV3.PathsObject = {}

  for (const op of operations) {
    if (!paths[op.path]) {
      paths[op.path] = {}
    }

    const pathItem = paths[op.path] as OpenAPIV3.PathItemObject
    pathItem[op.method] = buildPublicOperation(op)
  }

  return paths
}

/**
 * Build OpenAPI specification
 *
 * @param options - Build options
 */
export function buildOpenApi(options: BuildOpenApiOptions): OpenAPIV3.Document {
  const { mode, serverUrl, version = '1.0.0' } = options

  // Determine which routes/operations to include
  const isPublicMode = mode === 'public'
  const routes: InternalRouteDefinition[] = isPublicMode ? [] : internalRoutes
  const pubOps: PublicOperationMeta[] = isPublicMode ? publicOperations : []

  // Build the spec
  const spec: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: {
      title: mode === 'internal' ? `${API_TITLE} (Internal)` : API_TITLE,
      description:
        mode === 'internal'
          ? `**INTERNAL API DOCUMENTATION**\n\nThis documentation covers all API endpoints for development and debugging. Not for public consumption.\n\n${API_DESCRIPTION}`
          : API_DESCRIPTION,
      version,
      contact: {
        name: 'CloudMSP Support',
      },
    },
    servers: [
      {
        url: serverUrl || '/',
        description: mode === 'internal' ? 'Current server' : 'API Server',
      },
    ],
    tags: isPublicMode ? buildPublicTags(pubOps) : buildTags(routes),
    paths: isPublicMode ? buildPublicPaths(pubOps) : buildPaths(routes, mode),
    components: {
      securitySchemes,
      schemas: {
        ErrorResponse: errorResponseSchema,
      },
      responses: standardResponses,
    },
  }

  return spec
}

/**
 * Get the internal OpenAPI spec (cached for runtime use)
 */
let cachedInternalSpec: OpenAPIV3.Document | null = null

export function getInternalSpec(serverUrl?: string): OpenAPIV3.Document {
  if (!cachedInternalSpec) {
    cachedInternalSpec = buildOpenApi({ mode: 'internal', serverUrl })
  }
  return cachedInternalSpec
}

/**
 * Get the public OpenAPI spec (cached for runtime use)
 */
let cachedPublicSpec: OpenAPIV3.Document | null = null

export function getPublicSpec(serverUrl?: string): OpenAPIV3.Document {
  if (!cachedPublicSpec) {
    cachedPublicSpec = buildOpenApi({ mode: 'public', serverUrl })
  }
  return cachedPublicSpec
}

