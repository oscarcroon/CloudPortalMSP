/**
 * Certificates Layer Database Exports
 */

export { createCertificatesSchema, type CertificatesSchema } from './schema'

// Alias for auto-discovery: every layer exports createSchema
export { createCertificatesSchema as createSchema } from './schema'
