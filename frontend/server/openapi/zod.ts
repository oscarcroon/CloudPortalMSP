/**
 * Zod → OpenAPI Integration
 *
 * Provides helpers for converting Zod schemas to OpenAPI schemas
 * and registering them with stable names.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import type { OpenAPIV3 } from 'openapi-types'

// Extend Zod with OpenAPI methods
extendZodWithOpenApi(z)

// ============================================================================
// Registry
// ============================================================================

/**
 * Central OpenAPI registry for schema registration.
 * Use this to register reusable schemas with stable names.
 */
export const openApiRegistry = new OpenAPIRegistry()

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().int().describe('HTTP status code'),
    message: z.string().describe('Human-readable error message'),
    data: z.record(z.any()).optional().describe('Optional additional error context'),
  })
  .openapi('ErrorResponse')

openApiRegistry.register('ErrorResponse', ErrorResponseSchema)

/**
 * Standard pagination query parameters
 */
export const PaginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).optional().describe('Page number (1-based)'),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .optional()
      .describe('Items per page'),
  })
  .openapi('PaginationQuery')

openApiRegistry.register('PaginationQuery', PaginationQuerySchema)

/**
 * Standard pagination response metadata
 */
export const PaginationMetaSchema = z
  .object({
    page: z.number().int().describe('Current page number'),
    pageSize: z.number().int().describe('Items per page'),
    totalItems: z.number().int().describe('Total number of items'),
    totalPages: z.number().int().describe('Total number of pages'),
  })
  .openapi('PaginationMeta')

openApiRegistry.register('PaginationMeta', PaginationMetaSchema)

/**
 * Common ID parameter schema
 */
export const IdParamSchema = z
  .object({
    id: z.string().min(1).describe('Resource ID'),
  })
  .openapi('IdParam')

// ============================================================================
// Helpers
// ============================================================================

/**
 * Register a Zod schema with a stable name in the OpenAPI registry.
 * Returns the schema with OpenAPI metadata attached.
 *
 * @example
 * const UserSchema = registerSchema('User', z.object({
 *   id: z.string(),
 *   email: z.string().email(),
 * }))
 */
export function registerSchema<T extends z.ZodTypeAny>(name: string, schema: T): T {
  const schemaWithOpenApi = schema.openapi(name) as T
  openApiRegistry.register(name, schemaWithOpenApi)
  return schemaWithOpenApi
}

/**
 * Convert a Zod schema to OpenAPI schema object.
 * Uses the registry to resolve references.
 */
export function zodToOpenApiSchema(schema: z.ZodTypeAny): OpenAPIV3.SchemaObject {
  // Create a temporary generator to convert the schema
  const tempRegistry = new OpenAPIRegistry()
  tempRegistry.register('TempSchema', schema)

  const generator = new OpenApiGeneratorV3(tempRegistry.definitions)
  const doc = generator.generateDocument({
    openapi: '3.0.3',
    info: { title: 'Temp', version: '1.0.0' },
  })

  // Extract the schema
  const schemas = doc.components?.schemas || {}
  return (schemas['TempSchema'] as OpenAPIV3.SchemaObject) || { type: 'object' }
}

/**
 * Generate OpenAPI components from all registered schemas.
 */
export function generateSchemaComponents(): Record<string, OpenAPIV3.SchemaObject> {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions)
  const doc = generator.generateDocument({
    openapi: '3.0.3',
    info: { title: 'Temp', version: '1.0.0' },
  })

  return (doc.components?.schemas as Record<string, OpenAPIV3.SchemaObject>) || {}
}

// Re-export z for convenience
export { z }

