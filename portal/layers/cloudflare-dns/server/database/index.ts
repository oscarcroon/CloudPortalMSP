/**
 * Cloudflare DNS Plugin Database Exports
 *
 * This module re-exports the schema factory for use by the core application.
 */

export { createCloudflareDnsSchema, type CloudflareDnsSchema } from './schema'

// Alias for auto-discovery: every layer exports createSchema
export { createCloudflareDnsSchema as createSchema } from './schema'

