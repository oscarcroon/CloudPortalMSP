/**
 * API Token Scopes
 *
 * Defines available scopes for org API tokens.
 * These scopes are used in token creation and verification.
 */

// ============================================================================
// Scope Categories
// ============================================================================

/**
 * User-related scopes
 */
export const USER_SCOPES = {
  'user:read': 'Read user profile information',
  'user:write': 'Update user profile',
} as const

/**
 * Organization-related scopes
 */
export const ORGANIZATION_SCOPES = {
  'org:read': 'Read organization details',
  'org:write': 'Update organization settings',
  'org:members:read': 'Read organization members',
  'org:members:write': 'Manage organization members',
} as const

/**
 * DNS-related scopes
 */
export const DNS_SCOPES = {
  'dns:read': 'Read DNS zones and records',
  'dns:write': 'Create, update, delete DNS records',
  'dns:zones:read': 'Read DNS zones',
  'dns:zones:write': 'Create, update, delete DNS zones',
} as const

/**
 * Module-related scopes
 */
export const MODULE_SCOPES = {
  'modules:read': 'Read module configuration',
  'modules:write': 'Update module configuration',
} as const

/**
 * Admin scopes (use with caution)
 */
export const ADMIN_SCOPES = {
  'admin:read': 'Read administrative data',
  'admin:write': 'Perform administrative actions',
} as const

// ============================================================================
// All Scopes
// ============================================================================

export const ALL_SCOPES = {
  ...USER_SCOPES,
  ...ORGANIZATION_SCOPES,
  ...DNS_SCOPES,
  ...MODULE_SCOPES,
  ...ADMIN_SCOPES,
} as const

export type Scope = keyof typeof ALL_SCOPES

/**
 * Get description for a scope
 */
export function getScopeDescription(scope: string): string {
  return (ALL_SCOPES as Record<string, string>)[scope] || scope
}

/**
 * Validate that all scopes are known
 */
export function validateScopes(scopes: string[]): { valid: boolean; unknown: string[] } {
  const unknown = scopes.filter((s) => !(s in ALL_SCOPES))
  return {
    valid: unknown.length === 0,
    unknown,
  }
}

/**
 * Scope templates for common use cases
 */
export const SCOPE_TEMPLATES = {
  'Read Only': ['user:read', 'org:read', 'dns:read', 'modules:read'],
  'DNS Management': ['user:read', 'org:read', 'dns:read', 'dns:write'],
  'Full Access': Object.keys(ALL_SCOPES),
} as const

export type ScopeTemplateName = keyof typeof SCOPE_TEMPLATES

