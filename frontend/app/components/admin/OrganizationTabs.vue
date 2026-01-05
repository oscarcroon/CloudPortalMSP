<template>
  <nav class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="tab in tabs"
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

const props = defineProps<{
  slug: string
  active: 'overview' | 'members' | 'auth' | 'email' | 'delegations'
}>()

const route = useRoute()
const basePath = computed(() => {
  // Determine base path based on current route
  if (route.path.startsWith('/tenant-admin')) {
    return '/tenant-admin'
  }
  return '/platform-admin'
})

const tabs = [
  { key: 'overview', label: 'Översikt', icon: 'mdi:view-dashboard-outline' },
  { key: 'members', label: 'Medlemmar', icon: 'mdi:account-group-outline' },
  { key: 'auth', label: 'Auth & SSO', icon: 'mdi:shield-lock-outline' },
  { key: 'email', label: 'E-post', icon: 'mdi:email-outline' },
  { key: 'delegations', label: 'Delegationer', icon: 'mdi:account-hard-hat' }
]

const tabClass = (key: string) => {
  const base = 'border-slate-200 text-slate-600 hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200'
  if (props.active === key) {
    return 'border-brand bg-brand/10 text-brand dark:border-brand/80 dark:bg-brand/10 dark:text-brand/80'
  }
  return base
}
</script>

