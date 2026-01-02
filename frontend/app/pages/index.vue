<template>
  <section class="space-y-10">
    <div
      class="rounded-3xl px-6 py-10 text-white shadow-card"
      :style="heroGradientStyle"
    >
      <p class="text-sm uppercase tracking-[0.3em] text-white/70">Cloud Portal</p>
      <h1 class="mt-3 text-4xl font-semibold">{{ t('dashboard.title') }}</h1>
      <p class="mt-4 max-w-2xl text-white/80">
        {{ t('dashboard.subtitle') }}
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <StatusPill variant="success" dot>{{ t('dashboard.allSystemsOperational') }}</StatusPill>
        <StatusPill variant="info">{{ t('dashboard.organizations') }}: {{ organisations.length }}</StatusPill>
      </div>
    </div>

    <div v-if="loading" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="i in 6"
        :key="i"
        class="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
    <div v-else-if="modules.length > 0" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <DashboardCard
        v-for="module in modules"
        :key="module.id"
        :title="module.name"
        :description="getModuleDescription(module)"
        :badge="module.badge || t('dashboard.module')"
        :icon="module.icon"
        :disabled="module.disabled || false"
        :coming-soon-message="module.comingSoonMessage || null"
        :is-favorite="isFavorite(module.id)"
        :favorite-disabled="module.disabled || favoritesPending"
        @select="!module.disabled && navigateTo(module.routePath)"
        @toggle-favorite="handleToggleFavorite(module.id, module.disabled)"
      />
    </div>
    <div v-else class="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
      <Icon icon="mdi:package-variant" class="mx-auto h-12 w-12 text-slate-400" />
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
        {{ t('dashboard.noModules') }}
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:chart-line" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('dashboard.status') }}</h3>
        </div>
        <ul class="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="item in statusItems" :key="item.label" class="flex items-center justify-between">
            <span>{{ item.label }}</span>
            <StatusPill :variant="item.variant" dot>{{ item.value }}</StatusPill>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:newspaper-outline" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('dashboard.news') }}</h3>
        </div>
        <ul class="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="post in news" :key="post.title">
            <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ post.date }}</p>
            <p class="mt-1 font-medium text-slate-800 dark:text-slate-100">{{ post.title }}</p>
            <p class="text-slate-500 dark:text-slate-400">{{ post.summary }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import DashboardCard from '~/components/dashboard/DashboardCard.vue'
import { useAuth } from '~/composables/useAuth'
import { useModules } from '~/composables/useModules'
import { useFavorites } from '~/composables/useFavorites'

const { t } = useI18n()

const router = useRouter()
const auth = useAuth()
const { modules: allModules, loading, fetchVisibleModules } = useModules()
const { toggleFavorite, isFavorite, pending: favoritesPending } = useFavorites()

// Filtrera moduler för dashboarden:
// - Visa alla moduler som är enabled (eller undefined)
// - Inkludera disabled moduler (de ska visas utgråade)
// - Filtrera bort moduler som är helt inaktiverade (enabled === false)
const modules = computed(() => {
  return (allModules.value || []).filter((module) => {
    // Visa moduler som är enabled (eller undefined)
    // Disabled moduler (avaktiverade/coming-soon) ska visas men vara utgråade
    return module.effectiveEnabled !== false
  })
})

/**
 * Get localized module description using i18n key with fallback to raw description.
 * Layers define translations in their locale files (e.g. windowsDns.description).
 */
function getModuleDescription(module: { descriptionKey?: string; description?: string }): string {
  if (module.descriptionKey) {
    const translated = t(module.descriptionKey)
    // If translation key returns the key itself, fallback to raw description
    if (translated !== module.descriptionKey) {
      return translated
    }
  }
  return module.description ?? ''
}

const statusItems = [
  { label: 'Cloudflare API', value: t('dashboard.statusLabels.ok'), variant: 'success' },
  { label: 'Incus cluster', value: t('dashboard.statusLabels.degraded'), variant: 'warning' },
  { label: 'VM platform', value: t('dashboard.statusLabels.ok'), variant: 'success' },
  { label: 'WordPress', value: t('dashboard.statusLabels.maintenance'), variant: 'danger' }
] as const

const news = [
  {
    title: t('dashboard.newsItems.firstSite.title'),
    summary: t('dashboard.newsItems.firstSite.summary'),
    date: t('dashboard.newsItems.firstSite.date')
  },
  {
    title: t('dashboard.newsItems.dnsEmail.title'),
    summary: t('dashboard.newsItems.dnsEmail.summary'),
    date: t('dashboard.newsItems.dnsEmail.date')
  }
]

const organisations = auth.organizations

onMounted(async () => {
  await fetchVisibleModules()
})

// Dynamic gradient based on branding
const heroGradientStyle = computed(() => {
  const accentColor = auth.branding.value?.activeTheme.accentColor
  if (!accentColor) {
    // Fallback to default brand colors (same as CSS --brand and --brand-dark)
    return {
      background: 'linear-gradient(to right, rgb(28, 109, 208), rgb(15, 59, 115))'
    }
  }
  
  // Normalize color to hex if needed, then create darker version for gradient
  const normalizedColor = normalizeColorToHex(accentColor)
  const darkAccent = darkenColor(normalizedColor, 0.3)
  return {
    background: `linear-gradient(to right, ${normalizedColor}, ${darkAccent})`
  }
})

function normalizeColorToHex(color: string): string {
  // If already hex format, return as is
  if (color.startsWith('#')) {
    return color
  }
  
  // If rgb format, convert to hex
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const r = Number.parseInt(rgbMatch[1], 10)
    const g = Number.parseInt(rgbMatch[2], 10)
    const b = Number.parseInt(rgbMatch[3], 10)
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
  }
  
  // Default fallback
  return '#1C6DD0'
}

function darkenColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const bigint = Number.parseInt(clean, 16)
  if (Number.isNaN(bigint)) {
    return hex
  }
  
  const r = Math.max(0, Math.min(255, ((bigint >> 16) & 255) * (1 - amount)))
  const g = Math.max(0, Math.min(255, ((bigint >> 8) & 255) * (1 - amount)))
  const b = Math.max(0, Math.min(255, (bigint & 255) * (1 - amount)))
  
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function navigateTo(path: string) {
  router.push(path)
}

function handleToggleFavorite(moduleId: string, disabled?: boolean) {
  if (disabled || favoritesPending.value) {
    return
  }
  toggleFavorite(moduleId)
}
</script>

