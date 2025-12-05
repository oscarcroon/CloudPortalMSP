export type ModuleScope = 'tenant' | 'org' | 'user'

export interface ModuleMeta {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  scopes: ModuleScope[]
  featureFlag?: string
  requiredPermissions?: string[]
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
    featureFlag: 'feature.windowsDns',
    requiredPermissions: ['dns:windows:read']
  }
]

