import { manifests } from '../../../layers/plugin-manifests'
import type { PluginModuleManifest } from '../plugin-registry/types'
import type { ModuleMeta, ModuleRoleMeta, ModuleScope } from '~/lib/module-registry'
import type { RbacPermission } from '~/constants/rbac'

/**
 * Converts plugin manifest to ModuleMeta format
 */
export function manifestToModuleMeta(manifest: PluginModuleManifest): ModuleMeta {
  const { module, permissions } = manifest

  // Determine scopes based on module key pattern or default to org/user
  // Plugins ska synas på tenant- och org-nivå samt användarnivå
  const scopes: ModuleScope[] = ['tenant', 'org', 'user']

  // Use all manifest permissions as required permissions for the module
  const requiredPermissions: RbacPermission[] = permissions.map(
    (permission) => permission.key as RbacPermission
  )

  // Determine root route from module key (e.g., 'cloudflare-dns' -> '/cloudflare-dns')
  const rootRoute = `/${module.key.replace(/_/g, '-')}`

  return {
    key: module.key,
    name: module.name,
    description: module.description ?? '',
    category: module.category ?? 'infrastructure',
    layerKey: module.key,
    rootRoute,
    scopes,
    status: 'active',
    requiredPermissions,
    moduleRoles: [],
    roles: [],
    defaultAllowedRoles: [],
    icon: module.icon ?? 'mdi:puzzle',
    badge: module.category ? module.category.charAt(0).toUpperCase() + module.category.slice(1) : undefined
  }
}

const uniqueManifests: PluginModuleManifest[] = Array.from(
  new Map(manifests.map((manifest) => [manifest.module.key, manifest])).values()
)

/**
 * Get a specific plugin module by key
 */
export function getAllPluginModules(): ModuleMeta[] {
  return uniqueManifests.map(manifestToModuleMeta)
}

/**
 * Get a specific plugin module by key
 */
export function getPluginModuleByKey(key: string): ModuleMeta | undefined {
  const manifest = uniqueManifests.find((m) => m.module.key === key)
  return manifest ? manifestToModuleMeta(manifest) : undefined
}

