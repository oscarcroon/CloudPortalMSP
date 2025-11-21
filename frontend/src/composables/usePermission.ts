import { computed } from '#imports'
import { rolePermissionMap } from '~/constants/rbac'
import type { RbacPermission } from '~/constants/rbac'
import { useAuth } from './useAuth'

export const usePermission = () => {
  const auth = useAuth()

  const can = (permission: RbacPermission) =>
    computed(() => {
      if (auth.state.value.data?.user?.isSuperAdmin) {
        return true
      }
      const currentOrgId = auth.state.value.data?.currentOrgId
      if (!currentOrgId) {
        return false
      }
      const role = auth.state.value.data?.orgRoles[currentOrgId]
      if (!role) {
        return false
      }
      return rolePermissionMap[role]?.includes(permission) ?? false
    })

  const hasPermission = (permission: RbacPermission) => can(permission).value

  return {
    can,
    hasPermission
  }
}

