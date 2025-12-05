import { computed } from '#imports'
import { rolePermissionMap, tenantRolePermissionMap, tenantRoleOrgProxyPermissions } from '~/constants/rbac'
import type { RbacPermission, TenantRole } from '~/constants/rbac'
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
        const role = auth.state.value.data?.orgRoles[currentOrgId] as
          | keyof typeof rolePermissionMap
          | undefined
        if (role && rolePermissionMap[role]?.includes(permission)) {
          return true
        }

        // Check tenant-based org permissions via includeChildren
        // Only for org-level permissions (org:read, org:manage, etc.)
        if (permission.startsWith('org:')) {
          const currentOrg = auth.currentOrg.value
          let orgTenantId: string | null | undefined = currentOrg?.tenantId

          // Fallback: if currentOrg is null but currentOrgId exists, try to find tenantId from organizations list
          if (!orgTenantId && currentOrgId) {
            const orgFromList = auth.organizations.value.find((org: any) => org.id === currentOrgId)
            orgTenantId = orgFromList?.tenantId
          }

          if (orgTenantId) {
            const tenantId = orgTenantId
            const tenantRole = auth.state.value.data?.tenantRoles?.[tenantId] as TenantRole | undefined
            const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenantId] ?? false
            const tenant = auth.tenants.value.find((t: any) => t.id === tenantId)

            // Debug logging (only in dev)
            if (import.meta.dev && permission === 'org:manage') {
              console.log('[usePermission] Checking tenant-based org permission:', {
                permission,
                currentOrgId,
                orgTenantId: tenantId,
                tenantRole,
                includeChildren,
                tenantType: tenant?.type,
                hasTenant: !!tenant,
                proxyPermissions: tenantRole ? tenantRoleOrgProxyPermissions[tenantRole] : []
              })
            }

            // Check if user has tenant membership with includeChildren and tenant type allows proxying
            if (
              tenantRole &&
              includeChildren &&
              tenant &&
              (tenant.type === 'provider' || tenant.type === 'distributor')
            ) {
              const proxyPermissions = tenantRoleOrgProxyPermissions[tenantRole] ?? []
              if (proxyPermissions.includes(permission)) {
                if (import.meta.dev && permission === 'org:manage') {
                  console.log('[usePermission] ✅ Tenant-based permission granted via includeChildren')
                }
                return true
              }
            } else if (import.meta.dev && permission === 'org:manage') {
              console.log('[usePermission] ❌ Tenant-based permission denied:', {
                hasTenantRole: !!tenantRole,
                hasIncludeChildren: includeChildren,
                hasTenant: !!tenant,
                tenantType: tenant?.type,
                isAllowedType: tenant ? (tenant.type === 'provider' || tenant.type === 'distributor') : false
              })
            }
          } else if (import.meta.dev && permission === 'org:manage') {
            console.log('[usePermission] ❌ No tenantId found for current org:', {
              currentOrgId,
              currentOrg: currentOrg ? { id: currentOrg.id, tenantId: currentOrg.tenantId } : null,
                orgsInList: auth.organizations.value.map((o: any) => ({ id: o.id, tenantId: o.tenantId }))
            })
          }
        }
      }

      // Check tenant-level permissions
      if (permission.startsWith('tenants:')) {
        for (const [tenantId, tenantRole] of Object.entries(
          auth.state.value.data?.tenantRoles ?? {}
        ) as Array<[string, TenantRole]>) {
          if (tenantRolePermissionMap[tenantRole as TenantRole]?.includes(permission)) {
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

