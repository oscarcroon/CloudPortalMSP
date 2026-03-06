/**
 * API Token Scopes
 *
 * Defines available scopes for org API tokens.
 * Core scopes are defined here; layer/plugin scopes are aggregated from manifests.
 */
import { manifests } from '~~/layers/plugin-manifests'

// ============================================================================
// Types
// ============================================================================

export interface ScopeEntry {
  key: string
  description: string
  label?: string
}

export interface ScopeGroup {
  groupKey: string
  groupName: string
  icon?: string
  scopes: ScopeEntry[]
}

// ============================================================================
// Core Scope Categories
// ============================================================================

export const USER_SCOPES = {
  'user:read': 'Read user profile information',
  'user:write': 'Update user profile',
} as const

export const ORGANIZATION_SCOPES = {
  'org:read': 'Read organization details',
  'org:write': 'Update organization settings',
  'org:members:read': 'Read organization members',
  'org:members:write': 'Manage organization members',
} as const

export const MODULE_SCOPES = {
  'modules:read': 'Read module configuration',
  'modules:write': 'Update module configuration',
} as const

export const ADMIN_SCOPES = {
  'admin:read': 'Read administrative data',
  'admin:write': 'Perform administrative actions',
} as const

// ============================================================================
// Core scopes (without DNS — DNS is now registered per layer)
// ============================================================================

const CORE_SCOPES = {
  ...USER_SCOPES,
  ...ORGANIZATION_SCOPES,
  ...MODULE_SCOPES,
  ...ADMIN_SCOPES,
} as const

/**
 * ALL_SCOPES — kept for backwards compatibility but now includes layer scopes.
 */
export const ALL_SCOPES: Record<string, string> = {
  ...CORE_SCOPES,
}

// Merge layer-registered scopes into ALL_SCOPES at module load
for (const m of manifests) {
  if (m.apiScopes) {
    for (const s of m.apiScopes) {
      ALL_SCOPES[s.key] = s.description
    }
  }
}

export type Scope = string

// ============================================================================
// Functions
// ============================================================================

/**
 * Get all known scopes (core + layers)
 */
export function getAllKnownScopes(): ScopeEntry[] {
  return Object.entries(ALL_SCOPES).map(([key, description]) => ({ key, description }))
}

/**
 * Get a set of valid scope keys for fast validation
 */
export function getValidScopeKeys(): Set<string> {
  return new Set(Object.keys(ALL_SCOPES))
}

/**
 * Get description for a scope
 */
export function getScopeDescription(scope: string): string {
  return ALL_SCOPES[scope] || scope
}

/**
 * Validate that all scopes are known
 */
export function validateScopes(scopes: string[]): { valid: boolean; unknown: string[] } {
  const valid = getValidScopeKeys()
  const unknown = scopes.filter((s) => !valid.has(s))
  return {
    valid: unknown.length === 0,
    unknown,
  }
}

// ============================================================================
// Grouped scopes
// ============================================================================

const CORE_GROUPS: ScopeGroup[] = [
  {
    groupKey: 'user',
    groupName: 'User',
    icon: 'mdi:account',
    scopes: Object.entries(USER_SCOPES).map(([key, description]) => ({ key, description })),
  },
  {
    groupKey: 'organization',
    groupName: 'Organization',
    icon: 'mdi:domain',
    scopes: Object.entries(ORGANIZATION_SCOPES).map(([key, description]) => ({ key, description })),
  },
  {
    groupKey: 'modules',
    groupName: 'Modules',
    icon: 'mdi:puzzle',
    scopes: Object.entries(MODULE_SCOPES).map(([key, description]) => ({ key, description })),
  },
  {
    groupKey: 'admin',
    groupName: 'Administration',
    icon: 'mdi:shield-key',
    scopes: Object.entries(ADMIN_SCOPES).map(([key, description]) => ({ key, description })),
  },
]

/**
 * Return scopes grouped by category/module.
 * Core groups first, then one group per layer that has apiScopes.
 */
export function getScopesGrouped(): ScopeGroup[] {
  const groups: ScopeGroup[] = [...CORE_GROUPS]

  for (const m of manifests) {
    if (m.apiScopes && m.apiScopes.length > 0) {
      groups.push({
        groupKey: m.module.key,
        groupName: m.module.name,
        icon: m.module.icon,
        scopes: m.apiScopes.map((s) => ({ key: s.key, description: s.description, label: s.label })),
      })
    }
  }

  return groups
}

// ============================================================================
// Scope templates
// ============================================================================

/**
 * Build dynamic scope templates that include layer scopes.
 */
export function getScopeTemplates(): Record<string, string[]> {
  const allReadScopes: string[] = ['user:read', 'org:read', 'modules:read']
  const allScopes: string[] = Object.keys(ALL_SCOPES)

  // Collect layer read-scopes for the read-only template
  for (const m of manifests) {
    if (m.apiScopes) {
      for (const s of m.apiScopes) {
        if (s.key.endsWith(':read')) {
          allReadScopes.push(s.key)
        }
      }
    }
  }

  return {
    readOnly: allReadScopes,
    fullAccess: allScopes,
  }
}

/** @deprecated Use getScopeTemplates() instead */
export const SCOPE_TEMPLATES = {
  'Read Only': ['user:read', 'org:read', 'modules:read'],
  'Full Access': Object.keys(ALL_SCOPES),
} as const

export type ScopeTemplateName = keyof typeof SCOPE_TEMPLATES
