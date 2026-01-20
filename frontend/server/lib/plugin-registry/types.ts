import type { RbacRole } from '~/constants/rbac'

export interface PluginModuleManifestPermission {
  key: string
  description?: string
  label?: string
}

export type PluginModuleRbacDefaults = Partial<Record<RbacRole, string[]>>

export interface PluginModuleManifest {
  module: {
    key: string
    name: string
    description?: string
    category?: string
    icon?: string
  }
  /**
   * Canonical permission-lista för modulen (manifest-källa).
   */
  permissions: PluginModuleManifestPermission[]
  /**
   * Mapping från Core RBAC-roller till modulens permissions.
   * Inga modul-specifika roller längre.
   */
  rbacDefaults: PluginModuleRbacDefaults
}



