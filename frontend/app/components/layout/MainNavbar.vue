<template>
  <nav class="text-white" :style="{ backgroundColor: navBackgroundColor }">
    <div class="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-4 flex-shrink-0">
        <NuxtLink to="/" class="flex items-center gap-2 flex-shrink-0">
          <ClientOnly>
            <img
              :src="activeLogo"
              :alt="`${activeOrganisationName} logo`"
              class="h-10 w-auto max-h-10 object-contain flex-shrink-0"
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
            <span>{{ t('nav.dashboard') }}</span>
          </NuxtLink>
        </li>
        <li v-for="module in visiblePrimaryModules" :key="module.id">
          <NuxtLink
            :to="module.disabled ? '#' : module.routePath"
            class="flex items-center gap-2 whitespace-nowrap py-2 transition"
            :class="[
              module.disabled
                ? 'text-white/50 cursor-not-allowed'
                : isNavActive(module.routePath)
                  ? 'text-brand-light border-b border-brand-light bg-[color:var(--nav-active-color)] hover:[background-color:var(--nav-hover-color)] hover:text-brand-light'
                  : 'text-white hover:[background-color:var(--nav-hover-color)] hover:text-brand-light'
            ]"
            :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
            @click.prevent="module.disabled ? undefined : undefined"
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
              :aria-label="t('nav.showMore')"
            >
              <Icon icon="mdi:chevron-down" class="h-4 w-4 transition-transform group-hover:rotate-180" />
            </button>
            <ul
              class="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-lg border border-slate-700 opacity-0 shadow-lg transition-all pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto invisible group-hover:visible"
              :style="{ backgroundColor: navBackgroundColor }"
            >
              <li v-for="module in overflowNavModules" :key="module.id">
                <NuxtLink
                  :to="module.disabled ? '#' : module.routePath"
                  class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm transition"
                  :class="[
                    module.disabled
                      ? 'text-white/50 cursor-not-allowed'
                      : isNavActive(module.routePath)
                        ? 'text-brand-light bg-[color:var(--nav-active-color)] hover:[background-color:var(--nav-hover-color)] hover:text-brand-light'
                        : 'text-white hover:[background-color:var(--nav-hover-color)] hover:text-brand-light'
                  ]"
                  :style="{ '--nav-hover-color': navHoverColor, '--nav-active-color': navActiveColor }"
                  @click.prevent="module.disabled ? undefined : undefined"
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
              <span>{{ t('nav.settings') }}</span>
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
        <span>{{ t('nav.dashboard') }}</span>
      </NuxtLink>
      <NuxtLink
        v-for="module in mobileNavModules"
        :key="module.id"
        :to="module.disabled ? '#' : module.routePath"
        :class="[
          'flex items-center gap-2 py-2 text-sm',
          module.disabled ? 'text-white/50 cursor-not-allowed' : 'text-white'
        ]"
        @click="module.disabled ? undefined : (mobileOpen = false)"
      >
        <Icon v-if="module.icon" :icon="module.icon" class="h-4 w-4 flex-shrink-0" />
        <span>{{ module.name }}</span>
      </NuxtLink>
      <div v-if="adminNavItems.length > 0" class="mt-2 pt-2 border-t border-slate-700">
        <p class="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {{ t('nav.adminSection') }}
        </p>
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
import { computed, onMounted, ref, useI18n, useRoute } from '#imports'
import { useWindowSize } from '@vueuse/core'
import ContextSwitcher from '~/components/navigation/ContextSwitcher.vue'
import { useAuth } from '~/composables/useAuth'
import { useModules, type VisibleModule } from '~/composables/useModules'
import { useFavorites } from '~/composables/useFavorites'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { usePermission } from '~/composables/usePermission'
import { normalizeLogoUrl } from '~/utils/logo'
import { DEFAULT_NAV_BACKGROUND } from '~~/shared/branding'

const DEFAULT_NAV_RGB: [number, number, number] = (() => {
  const clean = DEFAULT_NAV_BACKGROUND.replace('#', '')
  const value = Number.parseInt(clean, 16)
  if (Number.isNaN(value)) {
    return [15, 28, 47]
  }
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
})()

const route = useRoute()
const { t } = useI18n()
const mobileOpen = ref(false)
const auth = useAuth()
const defaultLogo = defaultLogoAsset
const modulesStore = useModules()
const { favoriteModules, nonFavoriteModules } = useFavorites()
const { width } = useWindowSize()
const { can } = usePermission()

const activeLogo = computed(() => {
  const orgLogoUrl = auth.currentOrg.value?.logoUrl
  const normalized = normalizeLogoUrl(orgLogoUrl)
  return normalized ?? defaultLogo
})
const activeOrganisationName = computed(
  () => auth.currentOrg.value?.name ?? 'CoreIT Cloud Portal'
)
const navBackgroundColor = computed(
  () => auth.branding.value?.activeTheme.navigationBackgroundColor ?? DEFAULT_NAV_BACKGROUND
)
const navHoverColor = computed(() => mixColor(navBackgroundColor.value, '#FFFFFF', 0.10))
const navActiveColor = computed(() => mixColor(navBackgroundColor.value, '#FFFFFF', 0))

const accessibleModules = computed(() => {
  const list = modulesStore.modules.value ?? []
  if (!Array.isArray(list)) return []
  // Filtrera bort moduler som är:
  // 1. Helt inaktiverade (enabled === false)
  // 2. Avaktiverade (disabled === true) - dessa ska inte visas i navigationen
  // 3. "Kommer snart" (disabled === true med comingSoonMessage) - dessa ska inte visas i navigationen
  return list.filter((module: VisibleModule) => {
    // Visa endast moduler som är enabled OCH inte disabled
    return module.effectiveEnabled !== false && !module.disabled
  })
})

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
  // Use a consistent default width on server to avoid hydration mismatch
  // On server, width.value will be undefined, so we use 0 to get the default (2)
  // On client, use the actual width value
  const currentWidth = process.client && width.value ? width.value : 0
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

const canManageOrg = can('org:manage')

const getTenantTypeIcon = (type: string | undefined): string => {
  switch (type) {
    case 'distributor':
      return 'mdi:city'
    case 'provider':
      return 'mdi:store'
    default:
      return 'mdi:office-building-outline'
  }
}

const adminNavItems = computed(() => {
  const items = []

  if (canManageOrg.value) {
    items.push({ label: t('nav.settings'), to: '/settings', icon: 'mdi:cog' })
  }
  const hasTenantAccess =
    auth.isSuperAdmin.value ||
    Object.keys(auth.state.value.data?.tenantRoles ?? {}).length > 0
  if (hasTenantAccess) {
    const tenantIcon = getTenantTypeIcon(auth.currentTenant.value?.type)
    items.push({ label: t('nav.tenantAdmin'), to: '/tenant-admin', icon: tenantIcon })
  }
  if (auth.isSuperAdmin.value) {
    items.push({ label: t('nav.superadmin'), to: '/platform-admin', icon: 'mdi:shield-crown' })
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

function hexToRgbArray(hex: string | null | undefined): [number, number, number] {
  if (!hex) {
    return DEFAULT_NAV_RGB
  }
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return DEFAULT_NAV_RGB
  }
  const bigint = Number.parseInt(clean, 16)
  if (Number.isNaN(bigint)) {
    return DEFAULT_NAV_RGB
  }
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

onMounted(async () => {
  await modulesStore.fetchVisibleModules()
})
</script>

