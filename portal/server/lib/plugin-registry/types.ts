import type { RbacRole } from '~/constants/rbac'

export interface PluginModuleManifestPermission {
  key: string
  description?: string
  label?: string
}

export type PluginModuleRbacDefaults = Partial<Record<RbacRole, string[]>>

export interface PluginModuleHealthCheck {
  /** Server-side API path the layer exposes (e.g. '/api/dns/cloudflare/health') */
  endpoint: string
  /** Display label (e.g. 'Cloudflare API') */
  label: string
  /** Timeout in ms (default 5000) */
  timeout?: number
}

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
  /**
   * Optional health check configuration for tenant-admin system health card.
   */
  healthCheck?: PluginModuleHealthCheck
}



