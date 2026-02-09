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
        :coming-soon-message="module.comingSoonMessage || undefined"
        :is-favorite="isFavorite(module.id)"
        :favorite-disabled="module.disabled || favoritesPending"
        @select="!module.disabled && navigateTo(module.routePath)"
        @toggle-favorite="handleToggleFavorite(module.id, module.disabled)"
      />
    </div>
    <div v-else class="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
      <Icon icon="mdi:package-variant" class="mx-auto h-12 w-12 text-slate-400" />
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
        {{ noModulesMessage }}
      </p>
      <div v-if="isTenantOnlyContext" class="mt-4">
        <NuxtLink
          to="/tenant-admin"
          class="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 dark:focus:ring-offset-slate-800"
        >
          {{ t('dashboard.goToTenantAdmin') }}
        </NuxtLink>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:alert-circle-outline" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('dashboard.activeIncidents') }}</h3>
        </div>

        <!-- Has active incidents -->
        <template v-if="activeIncidents.length > 0">
          <ul class="mt-4 space-y-2">
            <li
              v-for="incident in activeIncidents.slice(0, 5)"
              :key="incident.id"
              class="flex items-center gap-3 rounded-lg border px-3 py-2"
              :class="dashboardIncidentBorderClass(incident.severity)"
            >
              <Icon :icon="dashboardIncidentIcon(incident.severity)" class="h-4 w-4 flex-shrink-0" :class="dashboardIncidentIconClass(incident.severity)" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{{ incident.title }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ incident.sourceTenantName }}</p>
              </div>
              <StatusPill :variant="incidentSeverityVariant(incident.severity)" dot>
                {{ incident.severity }}
              </StatusPill>
            </li>
          </ul>
          <div v-if="activeIncidents.length > 5" class="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            +{{ activeIncidents.length - 5 }} {{ t('dashboard.moreIncidents') }}
          </div>
        </template>

        <!-- No active incidents -->
        <div v-else class="mt-4 flex flex-col items-center py-4 text-center">
          <Icon icon="mdi:check-circle-outline" class="h-10 w-10 text-emerald-500" />
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ t('dashboard.noActiveIncidents') }}</p>
        </div>

        <!-- Footer link -->
        <div class="mt-4 text-center">
          <NuxtLink
            to="/operations"
            class="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            {{ t('dashboard.viewIncidents') }}
            <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="heroicons:newspaper" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('dashboard.news') }}</h3>
        </div>
        
        <!-- Filter tabs -->
        <div class="mt-4 flex gap-2">
          <button
            v-for="filterOption in newsFilterOptions"
            :key="filterOption.value"
            :class="[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              newsFilter === filterOption.value
                ? 'bg-brand text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            ]"
            @click="newsFilter = filterOption.value"
          >
            {{ filterOption.label }}
          </button>
        </div>
        
        <!-- Loading state -->
        <div v-if="newsLoading" class="mt-4 space-y-3">
          <div v-for="i in 2" :key="i" class="animate-pulse">
            <div class="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="mt-2 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="mt-1 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        
        <!-- News list -->
        <ul v-else-if="filteredNews.length > 0" class="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="post in filteredNews" :key="post.id">
            <NuxtLink
              :to="`/news/${post.slug}`"
              class="group block rounded-lg p-2 -mx-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div class="flex items-center gap-2">
                <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {{ formatNewsDate(post.publishedAt) }}
                </p>
                <span class="text-xs text-slate-300 dark:text-slate-600">•</span>
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ post.sourceTenantName }}
                </p>
              </div>
              <p class="mt-1 font-medium text-slate-800 group-hover:text-brand dark:text-slate-100 dark:group-hover:text-brand">
                {{ post.title }}
              </p>
              <p class="text-slate-500 dark:text-slate-400">{{ post.summary }}</p>
            </NuxtLink>
          </li>
        </ul>

        <!-- View all link -->
        <div v-if="filteredNews.length > 0" class="mt-4 text-center">
          <NuxtLink
            to="/news"
            class="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            {{ t('news.viewAll') }}
            <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
          </NuxtLink>
        </div>
        
        <!-- Empty state -->
        <div v-else class="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <Icon icon="heroicons:newspaper" class="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p class="mt-2">{{ t('dashboard.noNews') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import DashboardCard from '~/components/dashboard/DashboardCard.vue'
import { useAuth } from '~/composables/useAuth'
import { useModules } from '~/composables/useModules'
import { useFavorites } from '~/composables/useFavorites'
import { useOperationsFeed, type FeedNewsPost } from '~/composables/useOperationsFeed'

const { t } = useI18n()

const router = useRouter()
const auth = useAuth()
const { modules: allModules, loading, fetchVisibleModules } = useModules()
const { toggleFavorite, isFavorite, pending: favoritesPending } = useFavorites()
const { latestNews, activeIncidents, loading: newsLoading, fetchFeed } = useOperationsFeed()

// News filter: 'all' | 'distributor' | 'provider'
type NewsFilter = 'all' | 'distributor' | 'provider'
const newsFilter = ref<NewsFilter>('all')

// Filter options for news
const newsFilterOptions = computed(() => [
  { value: 'all' as const, label: t('dashboard.newsFilter.all') },
  { value: 'distributor' as const, label: t('dashboard.newsFilter.distributor') },
  { value: 'provider' as const, label: t('dashboard.newsFilter.provider') }
])

// Filtered news based on sourceTenantType
const filteredNews = computed<FeedNewsPost[]>(() => {
  if (!latestNews.value || latestNews.value.length === 0) {
    return []
  }
  if (newsFilter.value === 'all') {
    return latestNews.value
  }
  return latestNews.value.filter((post) => post.sourceTenantType === newsFilter.value)
})

// Format date for display
function formatNewsDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

const hasOrganizationContext = computed(() => Boolean(auth.currentOrg.value?.id))
const hasTenantContext = computed(() => Boolean(auth.currentTenant.value?.id))
const isTenantOnlyContext = computed(() => hasTenantContext.value && !hasOrganizationContext.value)

const noModulesMessage = computed(() => {
  if (!hasOrganizationContext.value && hasTenantContext.value) {
    return t('dashboard.noModulesTenantContext')
  }
  if (!hasOrganizationContext.value && !hasTenantContext.value) {
    return t('dashboard.noModulesNoContext')
  }
  return t('dashboard.noModules')
})

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

const organisations = auth.organizations

function dashboardIncidentIcon(severity: string): string {
  switch (severity) {
    case 'critical': return 'mdi:alert-circle'
    case 'outage': return 'mdi:alert'
    case 'maintenance': return 'mdi:wrench'
    case 'planned': return 'mdi:calendar-clock'
    default: return 'mdi:information'
  }
}

function dashboardIncidentIconClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-500'
    case 'outage': return 'text-orange-500'
    case 'maintenance':
    case 'planned': return 'text-blue-500'
    default: return 'text-amber-500'
  }
}

function dashboardIncidentBorderClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5'
    case 'outage': return 'border-orange-200 bg-orange-50/50 dark:border-orange-500/30 dark:bg-orange-500/5'
    case 'maintenance':
    case 'planned': return 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/5'
    default: return 'border-slate-200 dark:border-white/10'
  }
}

function incidentSeverityVariant(severity: string): string {
  switch (severity) {
    case 'critical': return 'danger'
    case 'outage': return 'warning'
    case 'maintenance':
    case 'planned': return 'info'
    default: return 'info'
  }
}

onMounted(async () => {
  await Promise.all([
    fetchVisibleModules(),
    fetchFeed()
  ])
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
    const r = Number.parseInt(rgbMatch[1]!, 10)
    const g = Number.parseInt(rgbMatch[2]!, 10)
    const b = Number.parseInt(rgbMatch[3]!, 10)
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

