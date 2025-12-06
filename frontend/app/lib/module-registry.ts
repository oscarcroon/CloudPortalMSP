import type { RbacPermission } from '~/constants/rbac'
import { manifests } from '../../layers/plugin-manifests'

export type ModuleScope = 'tenant' | 'org' | 'user'
export type ModuleStatus = 'active' | 'beta' | 'deprecated' | 'coming-soon'
export type ModuleVisibilityMode = 'everyone' | 'moduleRoles'

export interface ModuleRoleMeta {
  key: string
  label: string
  description?: string
  /**
   * Extra permissions that represent the role’s capabilities
   * (used in UI and seeding)
   */
  requiredPermissions: RbacPermission[]
  /**
   * Legacy flag to keep compatibility with older capabilities-based UI
   */
  capabilities?: {
    read?: boolean
    write?: boolean
    manage?: boolean
  }
}

export interface ModuleMeta {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  scopes: ModuleScope[]
  status?: ModuleStatus
  featureFlag?: string
  requiredPermissions?: RbacPermission[]
  moduleRoles?: ModuleRoleMeta[]
  /**
   * Legacy alias kept for backward compatibility
   */
  roles?: ModuleRoleMeta[]
  defaultAllowedRoles?: string[]
  icon?: string
  badge?: string
  visibilityMode?: ModuleVisibilityMode
}

/**
 * Convert plugin manifest (from layers/plugin-manifests) to ModuleMeta used by app
 */
const manifestToModuleMeta = (manifest: (typeof manifests)[number]): ModuleMeta => {
  const { module, permissions, roles } = manifest
  const scopes: ModuleScope[] = ['org', 'user']

  const moduleRoles = (roles ?? []).map((role) => ({
    key: role.key,
    label: role.label,
    description: role.description,
    requiredPermissions: role.permissions as RbacPermission[],
    capabilities: {
      read: role.permissions.some((p) => p.includes(':read') || p.includes(':view')),
      write: role.permissions.some((p) => p.includes(':write') || p.includes(':edit')),
      manage: role.permissions.some((p) => p.includes(':admin') || p.includes(':manage')) || role.key.includes('admin')
    }
  }))

  const requiredPermissions: RbacPermission[] =
    permissions && permissions.length > 0 ? [permissions[0].key as RbacPermission] : []

  const rootRoute = `/${module.key.replace(/_/g, '-')}`

  return defineModule({
    key: module.key,
    name: module.name,
    description: module.description ?? '',
    category: module.category ?? 'infrastructure',
    layerKey: module.key,
    rootRoute,
    scopes,
    status: 'active',
    requiredPermissions,
    moduleRoles,
    defaultAllowedRoles: roles?.map((r) => r.key) ?? [],
    icon: 'mdi:puzzle',
    badge: module.category ? module.category.charAt(0).toUpperCase() + module.category.slice(1) : undefined
  })
}

const warn = (message: string, payload?: Record<string, unknown>) => {
  if (process.dev) {
     
    console.warn(`[module-registry] ${message}`, payload ?? {})
  }
}

const seenModuleKeys = new Set<string>()

export const defineModule = (meta: ModuleMeta): ModuleMeta => {
  const moduleRoles = meta.moduleRoles ?? meta.roles ?? []
  const normalized: ModuleMeta = {
    ...meta,
    requiredPermissions: meta.requiredPermissions ?? [],
    moduleRoles,
    roles: moduleRoles,
    status: meta.status ?? 'active',
    defaultAllowedRoles: meta.defaultAllowedRoles ?? []
  }

  if (!normalized.key?.trim()) {
    warn('Module missing key', { meta })
  }

  if (seenModuleKeys.has(normalized.key)) {
    warn('Duplicate module key detected', { key: normalized.key })
  } else {
    seenModuleKeys.add(normalized.key)
  }

  if (!normalized.rootRoute?.startsWith('/')) {
    warn('Module rootRoute should start with "/"', { key: normalized.key, rootRoute: normalized.rootRoute })
  }

  if (!normalized.layerKey?.trim()) {
    warn('Module missing layerKey', { key: normalized.key })
  }

  const roleKeys = new Set<string>()
  normalized.moduleRoles?.forEach((role) => {
    if (!role.key?.trim()) {
      warn('Module role missing key', { moduleKey: normalized.key, role })
    }
    if (roleKeys.has(role.key)) {
      warn('Duplicate module role key', { moduleKey: normalized.key, roleKey: role.key })
    } else {
      roleKeys.add(role.key)
    }
  })

  return normalized
}

// Legacy modules that are not plugin-based
const legacyModules: ModuleMeta[] = [
  defineModule({
    key: 'windows-dns',
    name: 'Windows DNS',
    description: 'Hantera DNS-zoner i Windows-miljöer.',
    category: 'dns',
    layerKey: 'windows-dns',
    rootRoute: '/dns/windows',
    scopes: ['tenant', 'org', 'user'],
    status: 'beta',
    featureFlag: 'feature.windowsDns',
    requiredPermissions: ['dns:windows:read'],
    moduleRoles: [
      {
        key: 'viewer',
        label: 'Viewer',
        description: 'Read-only access to DNS zones and records.',
        requiredPermissions: ['dns:windows:read'],
        capabilities: { read: true }
      },
      {
        key: 'editor',
        label: 'Editor',
        description: 'Edit DNS records within existing zones.',
        requiredPermissions: ['dns:windows:write', 'dns:windows:read'],
        capabilities: { read: true, write: true }
      },
      {
        key: 'admin',
        label: 'Admin',
        description: 'Manage zones and records (add/remove zones, edit records).',
        requiredPermissions: ['dns:windows:admin', 'dns:windows:write', 'dns:windows:read'],
        capabilities: { read: true, write: true, manage: true }
      }
    ],
    defaultAllowedRoles: ['viewer', 'editor', 'admin'],
    icon: 'mdi:server-network',
    badge: 'DNS'
  })
]

// Plugin-based modules (loaded from layer manifests) but skip keys that already exist in legacy set
const legacyKeys = new Set(legacyModules.map((m) => m.key))
const pluginModules = manifests
  .filter((manifest) => !legacyKeys.has(manifest.module.key))
  .map(manifestToModuleMeta)

export const ALL_MODULES: ModuleMeta[] = [...legacyModules, ...pluginModules]


