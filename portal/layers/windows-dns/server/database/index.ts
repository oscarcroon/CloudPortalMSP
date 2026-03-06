/**
 * Windows DNS Plugin Database Exports
 *
 * This module re-exports the schema factory for use by the core application.
 */

export { createWindowsDnsSchema, type WindowsDnsSchema } from './schema'

// Alias for auto-discovery: every layer exports createSchema
export { createWindowsDnsSchema as createSchema } from './schema'

