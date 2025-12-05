import type {
  ModuleMeta,
  ModuleRoleMeta,
  ModuleScope,
  ModuleStatus
} from '~/lib/module-registry'

export type PolicyMode = 'inherit' | 'default-closed' | 'allowlist' | 'blocked'

export interface ModulePolicy {
  moduleKey: string
  mode: PolicyMode
  allowedRoles: string[]
}

export interface ModuleStatusDto {
  key: string
  name: string
  description: string
  category: string
  layerKey: string
  rootRoute: string
  status: ModuleStatus
  scopes: ModuleScope[]
  featureFlag?: string
  requiredPermissions: string[]
  moduleRoles: ModuleRoleMeta[]
  roles?: ModuleRoleMeta[]
  tenantPolicy?: ModulePolicy
  orgPolicy?: ModulePolicy
  effectivePolicy: ModulePolicy
  tenantEnabled: boolean
  orgEnabled: boolean
  effectiveEnabled: boolean
  tenantDisabled?: boolean
  orgDisabled?: boolean
  effectiveDisabled?: boolean
}

export type { ModuleMeta, ModuleRoleMeta, ModuleScope, ModuleStatus }


