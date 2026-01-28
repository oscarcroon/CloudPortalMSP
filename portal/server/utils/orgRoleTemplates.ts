/**
 * Organization role templates.
 * 
 * Defines pre-built permission configurations for organization groups
 * that can be applied during setup wizard.
 */

import type { ModuleRegistryEntry, ModuleRiskClass } from '~~/server/modules/registry'

export type OrgRoleTemplateId = 'standard' | 'strict' | 'msp'

export interface OrgRoleTemplate {
  id: OrgRoleTemplateId
  name: string
  description: string
  /** Group configurations for this template */
  groups: OrgRoleGroupConfig[]
}

export interface OrgRoleGroupConfig {
  /** Group slug (matches org_groups.slug) */
  slug: string
  /** Group name */
  name: string
  /** Group description */
  description: string
  /** Permission rules for this group */
  permissionRules: OrgRolePermissionRule[]
}

export interface OrgRolePermissionRule {
  /** Which risk classes to include (empty = all) */
  riskClasses?: ModuleRiskClass[]
  /** Which actions to grant */
  actions: ('read' | 'create' | 'update' | 'delete' | 'manage' | 'other')[]
  /** Exclude specific modules by ID */
  excludeModules?: string[]
}

/**
 * Default organization groups created for all new organizations.
 */
export const DEFAULT_ORG_GROUPS: Pick<OrgRoleGroupConfig, 'slug' | 'name' | 'description'>[] = [
  {
    slug: 'org-admins',
    name: 'Org Admins',
    description: 'Full access to all activated modules'
  },
  {
    slug: 'operators',
    name: 'Operators',
    description: 'Read/write access to most modules, limited manage access'
  },
  {
    slug: 'members',
    name: 'Members',
    description: 'Standard access for regular organization members'
  },
  {
    slug: 'readonly',
    name: 'Read Only',
    description: 'View-only access to modules'
  },
  {
    slug: 'support',
    name: 'Support',
    description: 'Limited access for support personnel'
  }
]

/**
 * Standard template - balanced access for most organizations.
 */
export const STANDARD_TEMPLATE: OrgRoleTemplate = {
  id: 'standard',
  name: 'Standard',
  description: 'Balanced access levels suitable for most organizations',
  groups: [
    {
      slug: 'org-admins',
      name: 'Org Admins',
      description: 'Full access to all activated modules',
      permissionRules: [
        // Full access to everything
        { actions: ['read', 'create', 'update', 'delete', 'manage', 'other'] }
      ]
    },
    {
      slug: 'operators',
      name: 'Operators',
      description: 'Read/write access to most modules',
      permissionRules: [
        // Full CRUD on low/medium risk modules
        { riskClasses: ['low', 'medium'], actions: ['read', 'create', 'update', 'delete', 'other'] },
        // Read-only on high risk modules
        { riskClasses: ['high'], actions: ['read'] }
      ]
    },
    {
      slug: 'members',
      name: 'Members',
      description: 'Standard access for regular members',
      permissionRules: [
        // Read + limited write on low risk
        { riskClasses: ['low'], actions: ['read', 'create', 'update', 'other'] },
        // Read-only on medium/high risk
        { riskClasses: ['medium', 'high'], actions: ['read'] }
      ]
    },
    {
      slug: 'readonly',
      name: 'Read Only',
      description: 'View-only access',
      permissionRules: [
        // Read-only on low/medium risk modules
        { riskClasses: ['low', 'medium'], actions: ['read'] }
      ]
    },
    {
      slug: 'support',
      name: 'Support',
      description: 'Support personnel access',
      permissionRules: [
        // Broad read access
        { actions: ['read'] }
      ]
    }
  ]
}

/**
 * Strict template - minimal default access, explicit grants required.
 */
export const STRICT_TEMPLATE: OrgRoleTemplate = {
  id: 'strict',
  name: 'Strict',
  description: 'Minimal default access - users must be explicitly granted permissions',
  groups: [
    {
      slug: 'org-admins',
      name: 'Org Admins',
      description: 'Full access to all activated modules',
      permissionRules: [
        { actions: ['read', 'create', 'update', 'delete', 'manage', 'other'] }
      ]
    },
    {
      slug: 'operators',
      name: 'Operators',
      description: 'Limited write access',
      permissionRules: [
        // Only read + update on low risk
        { riskClasses: ['low'], actions: ['read', 'update'] },
        // Read-only on medium
        { riskClasses: ['medium'], actions: ['read'] }
      ]
    },
    {
      slug: 'members',
      name: 'Members',
      description: 'Minimal default access',
      permissionRules: [
        // Read-only on low risk only
        { riskClasses: ['low'], actions: ['read'] }
      ]
    },
    {
      slug: 'readonly',
      name: 'Read Only',
      description: 'View-only access',
      permissionRules: [
        // Only low risk read
        { riskClasses: ['low'], actions: ['read'] }
      ]
    },
    {
      slug: 'support',
      name: 'Support',
      description: 'Support personnel access',
      permissionRules: [
        // Minimal read
        { riskClasses: ['low'], actions: ['read'] }
      ]
    }
  ]
}

/**
 * MSP template - designed for managed service providers with support access.
 */
export const MSP_TEMPLATE: OrgRoleTemplate = {
  id: 'msp',
  name: 'MSP',
  description: 'Optimized for managed service providers with broader support access',
  groups: [
    {
      slug: 'org-admins',
      name: 'Org Admins',
      description: 'Full access to all activated modules',
      permissionRules: [
        { actions: ['read', 'create', 'update', 'delete', 'manage', 'other'] }
      ]
    },
    {
      slug: 'operators',
      name: 'Operators',
      description: 'Full operational access',
      permissionRules: [
        // Full CRUD on all risk levels
        { actions: ['read', 'create', 'update', 'delete', 'other'] }
      ]
    },
    {
      slug: 'members',
      name: 'Members',
      description: 'Standard member access',
      permissionRules: [
        { riskClasses: ['low', 'medium'], actions: ['read', 'create', 'update', 'other'] },
        { riskClasses: ['high'], actions: ['read'] }
      ]
    },
    {
      slug: 'readonly',
      name: 'Read Only',
      description: 'View-only access',
      permissionRules: [
        { actions: ['read'] }
      ]
    },
    {
      slug: 'support',
      name: 'Support',
      description: 'Extended support access for MSP technicians',
      permissionRules: [
        // Broad read + limited safe writes
        { actions: ['read'] },
        { riskClasses: ['low'], actions: ['update'] }
      ]
    }
  ]
}

export const ALL_TEMPLATES: OrgRoleTemplate[] = [
  STANDARD_TEMPLATE,
  STRICT_TEMPLATE,
  MSP_TEMPLATE
]

/**
 * Get a template by ID.
 */
export function getOrgRoleTemplate(id: OrgRoleTemplateId): OrgRoleTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id)
}

/**
 * Calculate permissions for a group based on template rules and available modules.
 * Returns a map of moduleId -> granted permission keys.
 */
export function calculateGroupPermissions(
  groupConfig: OrgRoleGroupConfig,
  availableModules: ModuleRegistryEntry[]
): Map<string, string[]> {
  const result = new Map<string, string[]>()

  for (const module of availableModules) {
    const grantedPermissions = new Set<string>()

    for (const rule of groupConfig.permissionRules) {
      // Check if module is excluded
      if (rule.excludeModules?.includes(module.id)) {
        continue
      }

      // Check if risk class matches (empty = all)
      if (rule.riskClasses && rule.riskClasses.length > 0) {
        if (!rule.riskClasses.includes(module.riskClass)) {
          continue
        }
      }

      // Grant matching permissions
      for (const permission of module.permissions) {
        if (rule.actions.includes(permission.action)) {
          grantedPermissions.add(permission.key)
        }
      }
    }

    if (grantedPermissions.size > 0) {
      result.set(module.id, Array.from(grantedPermissions))
    }
  }

  return result
}
