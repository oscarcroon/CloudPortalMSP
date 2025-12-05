import type { RbacPermission } from '~/constants/rbac'

export type ModuleScope = 'tenant' | 'org' | 'user'
export type ModuleStatus = 'active' | 'beta' | 'deprecated' | 'coming-soon'
export type ModuleVisibilityMode = 'everyone' | 'moduleRoles'

export interface ModuleRoleDefinition {
  key: string
  label: string
  description?: string
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
  requiredPermissions: RbacPermission[]
  icon?: string
  badge?: string
  visibilityMode?: ModuleVisibilityMode
  roles?: ModuleRoleDefinition[]
  defaultAllowedRoles?: string[] | null
}

export const ALL_MODULES: ModuleMeta[] = [
  {
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
    icon: 'mdi:server-network',
    badge: 'DNS'
  }
]

