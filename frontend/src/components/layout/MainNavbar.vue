<template>
  <nav class="bg-[#0f1c2f] text-white">
    <div class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-4">
        <NuxtLink to="/" class="flex items-center gap-2">
          <ClientOnly>
            <img
              :src="activeLogo"
              :alt="`${activeOrganisationName} logo`"
              class="h-10 w-auto max-h-10 object-contain"
            />
            <template #fallback>
              <div class="h-10 w-10 bg-slate-700 animate-pulse rounded" />
            </template>
          </ClientOnly>
          <span class="sr-only">CoreIT Cloud Portal</span>
        </NuxtLink>
        <OrgSelector />
      </div>

      <button class="md:hidden" @click="mobileOpen = !mobileOpen" aria-label="Toggle navigation">
        <span v-if="!mobileOpen">☰</span>
        <span v-else>✕</span>
      </button>

      <ul class="hidden gap-6 text-sm md:flex">
        <li v-for="item in mainNavItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center gap-2 py-2 hover:text-brand-light"
            :class="isNavActive(item.to) ? 'text-brand-light border-b border-brand-light' : 'text-white'"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </NuxtLink>
        </li>
        <li v-if="adminNavItems.length > 0" class="relative group">
          <button
            class="flex items-center gap-2 py-2 hover:text-brand-light"
            :class="isAnyAdminActive ? 'text-brand-light border-b border-brand-light' : 'text-white'"
          >
            <Icon icon="mdi:cog" class="h-4 w-4" />
            Inställningar
            <Icon icon="mdi:chevron-down" class="h-3 w-3 transition-transform group-hover:rotate-180" />
          </button>
          <ul class="absolute top-full left-0 mt-1 bg-[#0f1c2f] border border-slate-700 rounded-lg shadow-lg min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <li v-for="item in adminNavItems" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-800"
                :class="isNavActive(item.to) ? 'text-brand-light bg-slate-800' : 'text-white'"
              >
                <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <div v-if="mobileOpen" class="border-t border-slate-800 px-4 py-3 md:hidden dark:border-slate-700">
      <NuxtLink
        v-for="item in mainNavItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-2 py-2 text-sm text-white"
        @click="mobileOpen = false"
      >
        <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </NuxtLink>
      <div v-if="adminNavItems.length > 0" class="mt-2 pt-2 border-t border-slate-700">
        <p class="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Inställningar</p>
        <NuxtLink
          v-for="item in adminNavItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 py-2 text-sm text-white"
          @click="mobileOpen = false"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from '#imports'
import OrgSelector from '~/components/layout/OrgSelector.vue'
import { useAuth } from '~/composables/useAuth'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { normalizeLogoUrl } from '~/utils/logo'

const route = useRoute()
const mobileOpen = ref(false)
const auth = useAuth()
const defaultLogo = defaultLogoAsset

const activeLogo = computed(() => {
  const orgLogoUrl = auth.currentOrg.value?.logoUrl
  const normalized = normalizeLogoUrl(orgLogoUrl)
  return normalized ?? defaultLogo
})
const activeOrganisationName = computed(
  () => auth.currentOrg.value?.name ?? 'CoreIT Cloud Portal'
)

const baseNavItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'DNS', to: '/dns' },
  { label: 'Containers', to: '/containers' },
  { label: 'VMs', to: '/vms' },
  { label: 'WordPress', to: '/wordpress' }
]

const mainNavItems = computed(() => {
  return [...baseNavItems]
})

const adminNavItems = computed(() => {
  const items = [
    { label: 'Inställningar', to: '/settings', icon: 'mdi:cog' }
  ]
  const hasTenantAccess =
    auth.isSuperAdmin.value ||
    Object.keys(auth.state.value.data?.tenantRoles ?? {}).length > 0
  if (hasTenantAccess) {
    items.push(
      { label: 'Tenants', to: '/admin/tenants', icon: 'mdi:account-group' },
      { label: 'Organisationer', to: '/admin/organizations', icon: 'mdi:office-building' }
    )
  } else if (auth.isSuperAdmin.value) {
    items.push({ label: 'Admin', to: '/admin/organizations', icon: 'mdi:shield-crown' })
  }
  return items
})

const isAnyAdminActive = computed(() => {
  return adminNavItems.value.some(item => isNavActive(item.to))
})

function isNavActive(target: string) {
  if (target === '/') {
    return route.path === '/'
  }

  return route.path.startsWith(target)
}
</script>

