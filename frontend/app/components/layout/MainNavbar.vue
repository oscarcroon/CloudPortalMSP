<template>
  <nav class="text-white" :style="{ backgroundColor: navBackgroundColor }">
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
        <ContextSwitcher />
      </div>

      <button class="md:hidden" @click="mobileOpen = !mobileOpen" aria-label="Toggle navigation">
        <span v-if="!mobileOpen">☰</span>
        <span v-else>✕</span>
      </button>

      <ul class="hidden items-center gap-5 text-sm md:flex">
        <li>
          <NuxtLink
            to="/"
            class="flex items-center gap-2 whitespace-nowrap py-2 transition hover:[background-color:var(--nav-hover-color)] hover:text-brand-light"
            :class="isNavActive('/') ? 'text-brand-light border-b border-brand-light bg-[color:var(--nav-active-color)]' : 'text-white'"
            :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
          >
            <Icon icon="mdi:view-dashboard" class="h-4 w-4 flex-shrink-0" />
            <span>Dashboard</span>
          </NuxtLink>
        </li>
        <li v-for="module in visiblePrimaryModules" :key="module.id">
          <NuxtLink
            :to="module.routePath"
            class="flex items-center gap-2 whitespace-nowrap py-2 transition hover:[background-color:var(--nav-hover-color)] hover:text-brand-light"
            :class="isNavActive(module.routePath) ? 'text-brand-light border-b border-brand-light bg-[color:var(--nav-active-color)]' : 'text-white'"
            :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
          >
            <Icon v-if="module.icon" :icon="module.icon" class="h-4 w-4 flex-shrink-0" />
            <span>{{ module.name }}</span>
          </NuxtLink>
        </li>
        <li v-if="hasOverflowModules">
          <div class="relative group">
            <button
              class="flex items-center gap-1 py-2 hover:text-brand-light"
              :class="hasOverflowModules ? 'text-white' : 'text-slate-400'"
              aria-label="Visa fler moduler"
            >
              <Icon icon="mdi:chevron-down" class="h-4 w-4 transition-transform group-hover:rotate-180" />
            </button>
            <ul
              class="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-lg border border-slate-700 opacity-0 shadow-lg transition-all pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto invisible group-hover:visible"
              :style="{ backgroundColor: navBackgroundColor }"
            >
              <li v-for="module in overflowNavModules" :key="module.id">
                <NuxtLink
                  :to="module.routePath"
                  class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm transition hover:[background-color:var(--nav-hover-color)] hover:text-brand-light"
                  :class="isNavActive(module.routePath) ? 'text-brand-light bg-[color:var(--nav-active-color)]' : 'text-white'"
                  :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
                >
                  <Icon v-if="module.icon" :icon="module.icon" class="h-4 w-4 flex-shrink-0" />
                  <span>{{ module.name }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </li>
        <li v-if="adminNavItems.length > 0">
          <div class="relative group">
            <button
              class="flex items-center gap-2 whitespace-nowrap py-2 hover:text-brand-light"
              :class="isAnyAdminActive ? 'text-brand-light border-b border-brand-light' : 'text-white'"
            >
              <Icon icon="mdi:cog" class="h-4 w-4 flex-shrink-0" />
              <span>Inställningar</span>
              <Icon icon="mdi:chevron-down" class="h-3 w-3 flex-shrink-0 transition-transform group-hover:rotate-180" />
            </button>
            <ul
              class="absolute top-full left-0 z-50 pt-1 min-w-[180px] rounded-lg border border-slate-700 opacity-0 shadow-lg transition-all pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto invisible group-hover:visible"
              :style="{ backgroundColor: navBackgroundColor }"
            >
            <li v-for="item in adminNavItems" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm transition hover:[background-color:var(--nav-hover-color)] hover:text-brand-light"
                :class="isNavActive(item.to) ? 'text-brand-light bg-[color:var(--nav-active-color)]' : 'text-white'"
                :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
              >
                <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4 flex-shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </li>
          </ul>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="mobileOpen" class="border-t border-slate-800 px-4 py-3 md:hidden dark:border-slate-700">
      <NuxtLink
        to="/"
        class="flex items-center gap-2 py-2 text-sm text-white"
        @click="mobileOpen = false"
      >
        <Icon icon="mdi:view-dashboard" class="h-4 w-4 flex-shrink-0" />
        <span>Dashboard</span>
      </NuxtLink>
      <NuxtLink
        v-for="module in mobileNavModules"
        :key="module.id"
        :to="module.routePath"
        class="flex items-center gap-2 py-2 text-sm text-white"
        @click="mobileOpen = false"
      >
        <Icon v-if="module.icon" :icon="module.icon" class="h-4 w-4 flex-shrink-0" />
        <span>{{ module.name }}</span>
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
          <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4 flex-shrink-0" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from '#imports'
import { useWindowSize } from '@vueuse/core'
import ContextSwitcher from '~/components/navigation/ContextSwitcher.vue'
import { useAuth } from '~/composables/useAuth'
import { useModules, type VisibleModule } from '~/composables/useModules'
import { useFavorites } from '~/composables/useFavorites'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { normalizeLogoUrl } from '~/utils/logo'
import { DEFAULT_NAV_BACKGROUND } from '~~/shared/branding'

const route = useRoute()
const mobileOpen = ref(false)
const auth = useAuth()
const defaultLogo = defaultLogoAsset
const modulesStore = useModules()
const { favoriteModules, nonFavoriteModules } = useFavorites()
const { width } = useWindowSize()

const activeLogo = computed(() => {
  const orgLogoUrl = auth.currentOrg.value?.logoUrl
  const normalized = normalizeLogoUrl(orgLogoUrl)
  return normalized ?? defaultLogo
})
const activeOrganisationName = computed(
  () => auth.currentOrg.value?.name ?? 'CoreIT Cloud Portal'
)
const navBackgroundColor = computed(
  () => auth.branding.value?.activeTheme.navBackgroundColor ?? DEFAULT_NAV_BACKGROUND
)
const navHoverColor = computed(() => mixColor(navBackgroundColor.value, '#FFFFFF', 0.10))
const navActiveColor = computed(() => mixColor(navBackgroundColor.value, '#FFFFFF', 0))

const accessibleModules = computed(() =>
  modulesStore.modules.value.filter((module: VisibleModule) => !module.disabled)
)

const dedupeModules = (items: VisibleModule[]) => {
  const seen = new Set<string>()
  const result: VisibleModule[] = []
  for (const item of items) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    result.push(item)
  }
  return result
}

const primaryNavSource = computed(() => {
  if (favoriteModules.value.length > 0) {
    return favoriteModules.value
  }
  return accessibleModules.value
})

const maxPrimaryLinks = computed(() => {
  const currentWidth = width.value
  if (currentWidth >= 1600) return 6
  if (currentWidth >= 1360) return 5
  if (currentWidth >= 1100) return 4
  return 2
})

const visiblePrimaryModules = computed(() =>
  primaryNavSource.value.slice(0, maxPrimaryLinks.value)
)

const overflowNavModules = computed(() => {
  const overflowFromSource = primaryNavSource.value.slice(maxPrimaryLinks.value)
  if (favoriteModules.value.length === 0) {
    return overflowFromSource
  }
  return dedupeModules([...overflowFromSource, ...nonFavoriteModules.value])
})

const hasOverflowModules = computed(() => overflowNavModules.value.length > 0)

const mobileNavModules = computed(() => {
  // If no favorites, show all accessible modules
  if (favoriteModules.value.length === 0) {
    return accessibleModules.value
  }
  // Show favorites first, then non-favorites
  // dedupeModules ensures no duplicates while preserving order
  return dedupeModules([...favoriteModules.value, ...nonFavoriteModules.value])
})

const adminNavItems = computed(() => {
  const items = [{ label: 'Inställningar', to: '/settings', icon: 'mdi:cog' }]
  const hasTenantAccess =
    auth.isSuperAdmin.value ||
    Object.keys(auth.state.value.data?.tenantRoles ?? {}).length > 0
  if (hasTenantAccess) {
    items.push({ label: 'Tenants', to: '/admin/tenants', icon: 'mdi:account-group' })
  }
  if (auth.isSuperAdmin.value) {
    items.push({ label: 'Superadmin', to: '/admin/settings', icon: 'mdi:shield-crown' })
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

function mixColor(baseHex: string, targetHex: string, amount: number) {
  const base = hexToRgbArray(baseHex)
  const target = hexToRgbArray(targetHex)
  const mixed = base.map((channel, index) => {
    const targetChannel = target[index] ?? channel
    return Math.round(channel + (targetChannel - channel) * amount)
  })
  return `rgb(${mixed.join(', ')})`
}

function hexToRgbArray(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const bigint = Number.parseInt(clean, 16)
  if (Number.isNaN(bigint)) {
    return hexToRgbArray(DEFAULT_NAV_BACKGROUND)
  }
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}
</script>

