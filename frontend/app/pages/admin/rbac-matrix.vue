<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">RBAC Matris</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Översikt över alla roller och deras rättigheter i systemet.
      </p>
    </header>

    <!-- Organization Roles Section -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Organisationsroller</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Roller som gäller på organisationsnivå
        </p>
      </div>
      <div class="overflow-x-auto p-6">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-white/10">
              <th class="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0c1524] z-10">
                Permission
              </th>
              <th
                v-for="role in orgRoles"
                :key="role"
                class="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]"
              >
                {{ getRoleLabel(role) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="permission in allOrgPermissions"
              :key="permission"
              class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <td class="py-3 px-4 text-sm text-slate-900 dark:text-white font-mono sticky left-0 bg-white dark:bg-[#0c1524] z-10">
                {{ permission }}
              </td>
              <td
                v-for="role in orgRoles"
                :key="`${permission}-${role}`"
                class="text-center py-3 px-4"
              >
                <Icon
                  v-if="hasOrgPermission(role, permission)"
                  icon="mdi:check-circle"
                  class="h-5 w-5 text-green-600 dark:text-green-400 mx-auto"
                />
                <span v-else class="text-slate-300 dark:text-slate-600">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tenant Roles Section -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Tenant-roller</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Roller som gäller på tenant-nivå (distributörer och leverantörer)
        </p>
      </div>
      <div class="overflow-x-auto p-6">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-white/10">
              <th class="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-[#0c1524] z-10">
                Permission
              </th>
              <th
                v-for="role in tenantRolesList"
                :key="role"
                class="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]"
              >
                {{ getTenantRoleLabel(role) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="permission in allTenantPermissions"
              :key="permission"
              class="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <td class="py-3 px-4 text-sm text-slate-900 dark:text-white font-mono sticky left-0 bg-white dark:bg-[#0c1524] z-10">
                {{ permission }}
              </td>
              <td
                v-for="role in tenantRolesList"
                :key="`${permission}-${role}`"
                class="text-center py-3 px-4"
              >
                <Icon
                  v-if="hasTenantPermission(role, permission)"
                  icon="mdi:check-circle"
                  class="h-5 w-5 text-green-600 dark:text-green-400 mx-auto"
                />
                <span v-else class="text-slate-300 dark:text-slate-600">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Legend -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-3">Förklaring</h3>
      <div class="space-y-2 text-sm text-slate-600 dark:text-slate-400">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:check-circle" class="h-5 w-5 text-green-600 dark:text-green-400" />
          <span>Rollen har denna permission</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-slate-300 dark:text-slate-600">—</span>
          <span>Rollen saknar denna permission</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  rbacRoles,
  tenantRoles,
  rbacPermissions,
  rolePermissionMap,
  tenantRolePermissionMap,
  type RbacRole,
  type TenantRole,
  type RbacPermission
} from '~/constants/rbac'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

// Get all unique permissions used by org roles
const allOrgPermissions = computed(() => {
  const permissions = new Set<RbacPermission>()
  for (const rolePermissions of Object.values(rolePermissionMap)) {
    rolePermissions.forEach(perm => permissions.add(perm))
  }
  return Array.from(permissions).sort()
})

// Get all unique permissions used by tenant roles
const allTenantPermissions = computed(() => {
  const permissions = new Set<RbacPermission>()
  for (const rolePermissions of Object.values(tenantRolePermissionMap)) {
    rolePermissions.forEach(perm => permissions.add(perm))
  }
  return Array.from(permissions).sort()
})

const orgRoles = rbacRoles
const tenantRolesList = tenantRoles

const hasOrgPermission = (role: RbacRole, permission: RbacPermission): boolean => {
  return rolePermissionMap[role]?.includes(permission) ?? false
}

const hasTenantPermission = (role: TenantRole, permission: RbacPermission): boolean => {
  return tenantRolePermissionMap[role]?.includes(permission) ?? false
}

const getRoleLabel = (role: RbacRole): string => {
  const labels: Record<RbacRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    operator: 'Operator',
    viewer: 'Viewer'
  }
  return labels[role] ?? role
}

const getTenantRoleLabel = (role: TenantRole): string => {
  const labels: Record<TenantRole, string> = {
    admin: 'Admin',
    user: 'User',
    viewer: 'Viewer',
    support: 'Support'
  }
  return labels[role] ?? role
}
</script>

