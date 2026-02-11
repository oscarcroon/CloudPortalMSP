<script setup lang="ts">
/**
 * WindowsDnsRedirect Zone Selection Page
 * Shows list of DNS zones with redirect counts
 */
const { t } = useI18n()

// Page title
useHead({
  title: computed(() => t('windowsDns.redirects.title')),
})

// Zone data and metadata
interface ZoneResponse {
  zones: any[]
  total: number
  source: 'api' | 'mock'
  apiError: string | null
}

const zones = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const sortOption = ref<'name-asc' | 'name-desc' | 'redirects-desc' | 'redirects-asc'>('name-asc')
const dataSource = ref<'api' | 'mock'>('mock')
const apiError = ref<string | null>(null)

// Filtered and sorted zones
const filteredZones = computed(() => {
  let result = [...zones.value]
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((zone) =>
      zone.name.toLowerCase().includes(query)
    )
  }
  return result.sort((a, b) => {
    switch (sortOption.value) {
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'redirects-desc': return (b.redirectCount || 0) - (a.redirectCount || 0)
      case 'redirects-asc': return (a.redirectCount || 0) - (b.redirectCount || 0)
      default: return a.name.localeCompare(b.name)
    }
  })
})

// Check if using mock data
const isUsingMockData = computed(() => dataSource.value === 'mock')

// Fetch zones on mount
onMounted(async () => {
  try {
    const response = await ($fetch as any)('/api/dns/windows/redirects/zones')
    zones.value = response?.zones || []
    dataSource.value = response?.source || 'mock'
    apiError.value = response?.apiError || null
    isLoading.value = false
  } catch (error) {
    console.error('Failed to load zones:', error)
    isLoading.value = false
  }
})
</script>

<template>
  <div class="p-6">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('windowsDns.redirects.zone_selection.title') }}
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        {{ t('windowsDns.redirects.zone_selection.description') }}
      </p>
    </div>

    <!-- Mock Data Warning Banner -->
    <div
      v-if="!isLoading && isUsingMockData"
      class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-amber-800 dark:text-amber-200">
            {{ t('windowsDns.redirects.zone_selection.mock_data_warning') }}
          </h3>
          <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {{ t('windowsDns.redirects.zone_selection.mock_data_description') }}
          </p>
          <p v-if="apiError" class="mt-2 text-xs text-amber-600 dark:text-amber-400 font-mono">
            {{ apiError }}
          </p>
        </div>
      </div>
    </div>

    <!-- Search & Sort -->
    <div class="mb-6 flex items-center gap-2 max-w-xl">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('windowsDns.redirects.zone_selection.search_placeholder')"
        class="flex-1 max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <select
        v-model="sortOption"
        class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="name-asc">{{ t('windowsDns.redirects.sort.nameAsc') }}</option>
        <option value="name-desc">{{ t('windowsDns.redirects.sort.nameDesc') }}</option>
        <option value="redirects-desc">{{ t('windowsDns.redirects.sort.redirectsDesc') }}</option>
        <option value="redirects-asc">{{ t('windowsDns.redirects.sort.redirectsAsc') }}</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredZones.length === 0"
      class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <p class="text-gray-500 dark:text-gray-400">
        {{ t('windowsDns.redirects.zone_selection.no_zones') }}
      </p>
    </div>

    <!-- Zone Grid -->
    <div
      v-else
      class="grid gap-4 md:grid-cols-2"
    >
      <NuxtLink
        v-for="zone in filteredZones"
        :key="zone.id"
        :to="`/dns/redirects/${zone.id}`"
        class="group block rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-medium text-slate-900 dark:text-slate-50">
              {{ zone.name }}
            </h3>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ t('windowsDns.redirects.zone_selection.redirect_count', { count: zone.redirectCount || 0 }) }}
            </p>
          </div>
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
