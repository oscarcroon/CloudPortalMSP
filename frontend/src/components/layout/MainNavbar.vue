<template>
  <nav class="bg-[#0f1c2f] text-white">
    <div class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-4">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img
            :src="activeLogo"
            :alt="`${activeOrganisationName} logo`"
            class="h-10 w-auto max-h-10 object-contain"
          />
          <span class="sr-only">CoreIT Cloud Portal</span>
        </NuxtLink>
        <OrgSelector />
      </div>

      <button class="md:hidden" @click="mobileOpen = !mobileOpen" aria-label="Toggle navigation">
        <span v-if="!mobileOpen">☰</span>
        <span v-else>✕</span>
      </button>

      <ul class="hidden gap-6 text-sm md:flex">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="py-2 hover:text-brand-light"
            :class="isNavActive(item.to) ? 'text-brand-light border-b border-brand-light' : 'text-white'"
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div v-if="mobileOpen" class="border-t border-slate-800 px-4 py-3 md:hidden dark:border-slate-700">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="block py-2 text-sm text-white"
        @click="mobileOpen = false"
      >
        {{ item.label }}
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports'
import OrgSelector from '~/components/layout/OrgSelector.vue'
import { useAuth } from '~/composables/useAuth'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'

const route = useRoute()
const mobileOpen = ref(false)
const auth = useAuth()
const defaultLogo = defaultLogoAsset

const activeLogo = computed(
  () => auth.currentOrg.value?.logoUrl ?? defaultLogo
)
const activeOrganisationName = computed(
  () => auth.currentOrg.value?.name ?? 'CoreIT Cloud Portal'
)

const baseNavItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'DNS', to: '/dns' },
  { label: 'Containers', to: '/containers' },
  { label: 'VMs', to: '/vms' },
  { label: 'WordPress', to: '/wordpress' },
  { label: 'Inställningar', to: '/settings' }
]

const navItems = computed(() => {
  const items = [...baseNavItems]
  if (auth.isSuperAdmin.value) {
    items.push({ label: 'Admin', to: '/admin/organizations' })
  }
  return items
})

function isNavActive(target: string) {
  if (target === '/') {
    return route.path === '/'
  }

  return route.path.startsWith(target)
}
</script>

