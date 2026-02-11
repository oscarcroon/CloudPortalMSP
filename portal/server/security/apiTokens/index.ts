/**
 * API Tokens Module
 *
 * Exports all functions for org API token management.
 */

// Token creation and verification utilities
export {
  createApiToken,
  parseApiToken,
  verifyApiToken,
  looksLikeApiToken,
  TOKEN_PREFIX_SCHEME,
  type TokenCreateResult,
  type TokenParseResult,
} from './tokenUtils'

// Authentication middleware
export {
  tryOrgApiToken,
  requireOrgApiToken,
  requireOrgApiScopes,
  requireOrgConstraint,
  type OrgApiTokenContext,
} from './ensureOrgApiToken'

// Rate limiting
export {
  checkApiTokenRateLimit,
  enforceApiTokenRateLimit,
} from './rateLimit'

// Scopes
export {
  ALL_SCOPES,
  USER_SCOPES,
  ORGANIZATION_SCOPES,
  MODULE_SCOPES,
  ADMIN_SCOPES,
  SCOPE_TEMPLATES,
  getScopeDescription,
  validateScopes,
  getAllKnownScopes,
  getValidScopeKeys,
  getScopesGrouped,
  getScopeTemplates,
  type Scope,
  type ScopeTemplateName,
  type ScopeEntry,
  type ScopeGroup,
} from './scopes'

