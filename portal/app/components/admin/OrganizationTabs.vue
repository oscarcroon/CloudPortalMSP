<template>
  <nav class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="tab in visibleTabs"
      :key="tab.key"
      :to="`${basePath}/organizations/${slug}/${tab.key}`"
      class="inline-flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-semibold transition"
      :class="tabClass(tab.key)"
    >
      <Icon :icon="tab.icon" class="h-4 w-4" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from '#imports'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const props = defineProps<{
  slug: string
  active: 'overview' | 'members' | 'auth' | 'email' | 'delegations'
}>()

const route = useRoute()
const auth = useAuth()

const basePath = computed(() => {
  // Determine base path based on current route
  if (route.path.startsWith('/tenant-admin')) {
    return '/tenant-admin'
  }
  if (route.path.startsWith('/admin')) {
    return '/admin'
  }
  return '/platform-admin'
})

const isTenantAdminPath = computed(() => route.path.startsWith('/tenant-admin'))

// Check if user has tenant manage permissions (owner or admin role)
const hasTenantManageAccess = computed(() => {
  // Superadmins always have access
  if (auth.isSuperAdmin.value) {
    return true
  }
  
  // Check tenant roles for admin/owner with manage permissions
  const tenantRoles = auth.tenantRoles.value
  for (const role of Object.values(tenantRoles)) {
    if (role === 'owner' || role === 'admin') {
      return true
    }
  }
  
  return false
})

const allTabs = [
  { key: 'overview', label: 'Översikt', icon: 'mdi:view-dashboard-outline', requiresManage: false },
  { key: 'members', label: 'Medlemmar', icon: 'mdi:account-group-outline', requiresManage: true },
  { key: 'auth', label: 'Auth & SSO', icon: 'mdi:shield-lock-outline', requiresManage: true },
  { key: 'email', label: 'E-post', icon: 'mdi:email-outline', requiresManage: true },
  { key: 'delegations', label: 'Delegationer', icon: 'mdi:account-hard-hat', requiresManage: true }
]

// Filter tabs based on user permissions and context
const visibleTabs = computed(() => {
  // On tenant-admin path, filter based on permissions
  if (isTenantAdminPath.value) {
    return allTabs.filter(tab => {
      // Overview is always visible
      if (!tab.requiresManage) {
        return true
      }
      // Other tabs require manage access
      return hasTenantManageAccess.value
    })
  }
  
  // On admin paths (superadmin), show all tabs
  return allTabs
})

const tabClass = (key: string) => {
  const base = 'border-slate-200 text-slate-600 hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200'
  if (props.active === key) {
    return 'border-brand bg-brand/10 text-brand dark:border-brand/80 dark:bg-brand/10 dark:text-brand/80'
  }
  return base
}
</script>

