import { computed } from '#imports'
import { rolePermissionMap, tenantRolePermissionMap } from '~/constants/rbac'
import type { RbacPermission } from '~/constants/rbac'
import { useAuth } from './useAuth'

export const usePermission = () => {
  const auth = useAuth()

  const can = (permission: RbacPermission) =>
    computed(() => {
      if (auth.state.value.data?.user?.isSuperAdmin) {
        return true
      }

      // Check organization-level permissions
      const currentOrgId = auth.state.value.data?.currentOrgId
      if (currentOrgId) {
        const role = auth.state.value.data?.orgRoles[currentOrgId]
        if (role && rolePermissionMap[role]?.includes(permission)) {
          return true
        }
      }

      // Check tenant-level permissions
      if (permission.startsWith('tenants:')) {
        for (const [tenantId, tenantRole] of Object.entries(
          auth.state.value.data?.tenantRoles ?? {}
        )) {
          if (tenantRolePermissionMap[tenantRole]?.includes(permission)) {
            return true
          }
        }
      }

      return false
    })

  const hasPermission = (permission: RbacPermission) => can(permission).value

  return {
    can,
    hasPermission
  }
}

