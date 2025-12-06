import { manifests } from '../../../layers/plugin-manifests'
import type { PluginModuleManifest } from '../plugin-registry/types'
import type { ModuleMeta, ModuleRoleMeta, ModuleScope } from '~/lib/module-registry'
import type { RbacPermission } from '~/constants/rbac'

/**
 * Converts plugin manifest to ModuleMeta format
 */
export function manifestToModuleMeta(manifest: PluginModuleManifest): ModuleMeta {
  const { module, permissions, roles } = manifest

  // Determine scopes based on module key pattern or default to org/user
  // Plugins are typically org/user scoped unless explicitly tenant-scoped
  const scopes: ModuleScope[] = ['org', 'user']

  const moduleRoles: ModuleRoleMeta[] = roles.map((role) => ({
    key: role.key,
    label: role.label,
    description: role.description,
    requiredPermissions: role.permissions as RbacPermission[],
    capabilities: {
      read: role.permissions.some((p) => p.includes(':read') || p.includes(':view')),
      write: role.permissions.some((p) => p.includes(':write') || p.includes(':edit')),
      manage:
        role.permissions.some((p) => p.includes(':admin') || p.includes(':manage')) ||
        role.key.includes('admin')
    }
  }))

  // Get first permission as required permission (usually the view/read permission)
  const requiredPermissions: RbacPermission[] =
    permissions.length > 0 ? [permissions[0].key as RbacPermission] : []

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
    moduleRoles,
    roles: moduleRoles,
    defaultAllowedRoles: roles.map((r) => r.key),
    icon: 'mdi:puzzle',
    badge: module.category ? module.category.charAt(0).toUpperCase() + module.category.slice(1) : undefined
  }
}

/**
 * Get all plugin manifests converted to ModuleMeta
 */
export function getAllPluginModules(): ModuleMeta[] {
  return manifests.map(manifestToModuleMeta)
}

/**
 * Get a specific plugin module by key
 */
export function getPluginModuleByKey(key: string): ModuleMeta | undefined {
  const manifest = manifests.find((m) => m.module.key === key)
  return manifest ? manifestToModuleMeta(manifest) : undefined
}

