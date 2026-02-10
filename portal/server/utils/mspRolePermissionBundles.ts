import type { TenantRole } from '~/constants/rbac'
import { manifests } from '~~/layers/plugin-manifests'
import { getDb } from './db'
import { modulePermissions } from '../database/schema'
import { eq, inArray } from 'drizzle-orm'

/**
 * Bundle represents a set of permissions for a specific module
 */
export interface PermissionBundle {
  moduleKey: string
  permissionKeys: string[]
}

/**
 * Mapping from MSP roles to permission bundles
 * Each MSP role grants specific module permissions based on the role's scope
 */
const mspRoleToModulePermissions: Record<string, Record<string, string[]>> = {
  'msp-global-admin': {
    // Full admin access to all modules
    '*': ['*'] // Special case: all permissions for all modules
  },
  'msp-global-reader': {
    // Read-only access to all modules
    '*': ['*:view', '*:read'] // Read permissions for all modules
  },
  'msp-cloudflare-admin': {
    'cloudflare-dns': [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_api'
    ]
  },
  'msp-containers-admin': {
    // Containers module permissions (when module exists)
    'containers': [
      'containers:view',
      'containers:edit',
      'containers:admin'
    ]
  },
  'msp-vms-admin': {
    // VMs module permissions
    'vms': [
      'vms:view',
      'vms:edit',
      'vms:admin'
    ]
  },
  'msp-wordpress-admin': {
    // WordPress module permissions
    'wordpress': [
      'wordpress:view',
      'wordpress:edit',
      'wordpress:admin'
    ]
  },
  'msp-ncentral-admin': {
    // nCentral module permissions
    'ncentral': [
      'ncentral:view',
      'ncentral:edit',
      'ncentral:admin'
    ]
  },
  'msp-monitoring-admin': {
    // Monitoring module permissions
    'monitoring': [
      'monitoring:view',
      'monitoring:edit',
      'monitoring:admin'
    ]
  },
  'msp-managed-server-admin': {
    // Managed Server module permissions
    'managed-server': [
      'managed-server:view',
      'managed-server:edit',
      'managed-server:admin'
    ]
  },
  'msp-dns-containers-admin': {
    'cloudflare-dns': [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_api'
    ],
    'containers': [
      'containers:view',
      'containers:edit',
      'containers:admin'
    ]
  },
  'msp-infrastructure-admin': {
    'cloudflare-dns': [
      'cloudflare-dns:view',
      'cloudflare-dns:edit_records',
      'cloudflare-dns:export',
      'cloudflare-dns:import',
      'cloudflare-dns:admin_zones',
      'cloudflare-dns:manage_api'
    ],
    'containers': [
      'containers:view',
      'containers:edit',
      'containers:admin'
    ],
    'vms': [
      'vms:view',
      'vms:edit',
      'vms:admin'
    ]
  },
  'msp-full-admin': {
    // Full admin access to all modules
    '*': ['*'] // Special case: all permissions for all modules
  }
}

/**
 * Get permission bundles for a set of MSP roles
 * Returns bundles grouped by module key
 * 
 * @param roles - Array of tenant roles (including MSP roles)
 * @param tenantId - Optional tenant ID to load dynamic roles from database
 */
export async function getBundlesForMspRoles(
  roles: TenantRole[],
  tenantId?: string
): Promise<PermissionBundle[]> {
  const mspRoleKeys = roles.filter((role) => role.startsWith('msp-'))
  if (mspRoleKeys.length === 0) {
    return []
  }

  // Collect all module permissions from manifests
  const manifestPermissions = new Map<string, Set<string>>()
  for (const manifest of manifests) {
    const moduleKey = manifest.module.key
    const perms = manifest.permissions || []
    const permSet = new Set<string>()
    for (const perm of perms) {
      const key = typeof perm === 'string' ? perm : perm.key
      permSet.add(key)
    }
    manifestPermissions.set(moduleKey, permSet)
  }

  // Get all valid permission keys from database registry
  const db = getDb()
  const allDbPermissions = await db
    .select({
      moduleKey: modulePermissions.moduleKey,
      permissionKey: modulePermissions.permissionKey
    })
    .from(modulePermissions)

  const dbPermissionMap = new Map<string, Set<string>>()
  for (const perm of allDbPermissions) {
    if (!dbPermissionMap.has(perm.moduleKey)) {
      dbPermissionMap.set(perm.moduleKey, new Set())
    }
    dbPermissionMap.get(perm.moduleKey)!.add(perm.permissionKey)
  }

  // Merge manifest and DB permissions (DB is source of truth for validation)
  const validPermissions = new Map<string, Set<string>>()
  for (const [moduleKey, perms] of manifestPermissions.entries()) {
    const dbPerms = dbPermissionMap.get(moduleKey) || new Set()
    validPermissions.set(moduleKey, dbPerms.size > 0 ? dbPerms : perms)
  }

  // Build bundles from role mappings
  const bundleMap = new Map<string, Set<string>>()

  for (const role of mspRoleKeys) {
    const roleMapping = mspRoleToModulePermissions[role]
    if (!roleMapping) {
      continue
    }

    // Handle wildcard roles (msp-global-admin, msp-full-admin)
    // Check both dynamic and hardcoded mappings
    const wildcardPerms = roleMapping['*']
    if (wildcardPerms && wildcardPerms.includes('*')) {
      // Grant all permissions for all modules
      for (const [moduleKey, perms] of validPermissions.entries()) {
        if (!bundleMap.has(moduleKey)) {
          bundleMap.set(moduleKey, new Set())
        }
        for (const perm of perms) {
          bundleMap.get(moduleKey)!.add(perm)
        }
      }
      continue
    }

    // Handle read-only wildcard (msp-global-reader)
    if (wildcardPerms && wildcardPerms.some((p) => p.includes('*:view') || p.includes('*:read'))) {
      // Grant read permissions for all modules
      for (const [moduleKey, perms] of validPermissions.entries()) {
        if (!bundleMap.has(moduleKey)) {
          bundleMap.set(moduleKey, new Set())
        }
        for (const perm of perms) {
          if (perm.includes(':view') || perm.includes(':read')) {
            bundleMap.get(moduleKey)!.add(perm)
          }
        }
      }
      continue
    }

    // Handle module-specific permissions
    for (const [moduleKey, permissionKeys] of Object.entries(roleMapping)) {
      if (moduleKey === '*') continue

      const validPerms = validPermissions.get(moduleKey)
      if (!validPerms) {
        // Module doesn't exist, skip
        continue
      }

      if (!bundleMap.has(moduleKey)) {
        bundleMap.set(moduleKey, new Set())
      }

      for (const permKey of permissionKeys) {
        // Validate permission exists in registry
        if (validPerms.has(permKey)) {
          bundleMap.get(moduleKey)!.add(permKey)
        } else {
          // Log warning for unknown permissions
          console.warn(
            `[mspRolePermissionBundles] Unknown permission key: ${permKey} for module ${moduleKey} (role: ${role})`
          )
        }
      }
    }
  }

  // Convert to array of bundles
  const bundles: PermissionBundle[] = []
  for (const [moduleKey, permissionKeys] of bundleMap.entries()) {
    bundles.push({
      moduleKey,
      permissionKeys: Array.from(permissionKeys)
    })
  }

  return bundles
}

/**
 * Get permission keys for a specific module from MSP roles
 * 
 * @param roles - Array of tenant roles (including MSP roles)
 * @param moduleKey - Module key to get permissions for
 * @param tenantId - Optional tenant ID to load dynamic roles from database
 */
export async function getModulePermissionsForMspRoles(
  roles: TenantRole[],
  moduleKey: string,
  tenantId?: string
): Promise<Set<string>> {
  const bundles = await getBundlesForMspRoles(roles, tenantId)
  const bundle = bundles.find((b) => b.moduleKey === moduleKey)
  return new Set(bundle?.permissionKeys || [])
}
