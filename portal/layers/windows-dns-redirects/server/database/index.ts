/**
 * WindowsDnsRedirects Database - Public API
 */
export { createWindowsDnsRedirectsSchema } from './schema'

// Alias for auto-discovery: every layer exports createSchema
export { createWindowsDnsRedirectsSchema as createSchema } from './schema'
export type {
  WindowsDnsRedirectsSchemaType,
  WindowsDnsRedirectRecord,
  NewWindowsDnsRedirectRecord,
  WindowsDnsRedirectHitRecord,
  NewWindowsDnsRedirectHitRecord,
  WindowsDnsRedirectOrgConfigRecord,
  NewWindowsDnsRedirectOrgConfigRecord,
  WindowsDnsRedirectImportLogRecord,
  NewWindowsDnsRedirectImportLogRecord,
} from './schema'
