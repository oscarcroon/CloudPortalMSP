import type { RbacPermission } from '~/constants/rbac'
import { manifests } from '../../layers/plugin-manifests'

export type ModuleScope = 'tenant' | 'org' | 'user'
export type ModuleStatus = 'active' | 'beta' | 'deprecated' | 'coming-soon'
export type ModuleVisibilityMode = 'everyone' | 'moduleRoles'

export interface ModuleRoleMeta {
  // Deprecated: modulroller fasas ut. Behålls för typer bakåtkomp. men används ej.
  key: string
  label: string
  description?: string
  requiredPermissions: RbacPermission[]
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
  /**
   * i18n key for the module description (e.g. 'windowsDns.description').
   * Generated automatically from module.key: 'windows-dns' → 'windowsDns.description'
   * Frontend should use $t(descriptionKey) with fallback to description.
   */
  descriptionKey: string
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
 * Convert module key to i18n description key.
 * Examples: 'windows-dns' → 'windowsDns.description', 'cloudflare-dns' → 'cloudflareDns.description'
 */
const moduleKeyToDescriptionKey = (key: string): string => {
  // Convert kebab-case to camelCase: 'windows-dns' → 'windowsDns'
  const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
  return `${camelKey}.description`
}

/**
 * Convert plugin manifest (from layers/plugin-manifests) to ModuleMeta used by app
 */
const manifestToModuleMeta = (manifest: (typeof manifests)[number]): ModuleMeta => {
  const { module, permissions } = manifest
  const scopes: ModuleScope[] = ['tenant', 'org', 'user']

  const requiredPermissions: RbacPermission[] =
    permissions?.map((permission: { key: string }) => permission.key as RbacPermission) ?? []

  // Special case: windows-dns uses /dns as route instead of /windows-dns
  const rootRoute = module.key === 'windows-dns' ? '/dns' : `/${module.key.replace(/_/g, '-')}`

  return defineModule({
    key: module.key,
    name: module.name,
    description: module.description ?? '',
    descriptionKey: moduleKeyToDescriptionKey(module.key),
    category: module.category ?? 'infrastructure',
    layerKey: module.key,
    rootRoute,
    scopes,
    status: 'active',
    requiredPermissions,
    moduleRoles: [],
    defaultAllowedRoles: [],
    icon: module.icon ?? 'mdi:puzzle',
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
    descriptionKey: meta.descriptionKey ?? moduleKeyToDescriptionKey(meta.key),
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

// Legacy modules (none remaining)
const legacyModules: ModuleMeta[] = []

// Plugin-based modules (loaded from layer manifests) but skip keys that already exist in legacy set
const legacyKeys = new Set(legacyModules.map((m) => m.key))
const uniquePluginManifests = Array.from(
  new Map(manifests.map((manifest) => [manifest.module.key, manifest])).values()
)
const pluginModules = uniquePluginManifests
  .filter((manifest) => !legacyKeys.has(manifest.module.key))
  .map(manifestToModuleMeta)

export const ALL_MODULES: ModuleMeta[] = [...legacyModules, ...pluginModules]


