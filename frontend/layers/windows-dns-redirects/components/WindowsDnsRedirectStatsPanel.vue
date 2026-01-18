<script setup lang="ts">
/**
 * WindowsDnsRedirect Statistics Panel Component
 * Collapsible panel showing redirect statistics with charts
 */
const props = defineProps<{
  zoneId: string
}>()

const { t } = useI18n()

const isExpanded = ref(false)
const isLoading = ref(false)
const stats = ref<{
  totalRedirects: number
  activeRedirects: number
  inactiveRedirects: number
  totalHits: number
  hitsToday: number
  byType: Record<string, number>
  topRedirects: Array<{ id: string; sourcePath: string; hitCount: number }>
  dailyHits: Array<{ date: string; count: number }>
} | null>(null)

const dateRange = ref('30d')
const dateRangeOptions = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

async function fetchStats() {
  isLoading.value = true
  try {
    const response = await $fetch<{ stats: typeof stats.value }>(`/api/dns/windows/zones/${props.zoneId}/redirects/stats`, {
      query: { range: dateRange.value }
    })
    stats.value = response.stats
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  } finally {
    isLoading.value = false
  }
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && !stats.value) {
    fetchStats()
  }
}

watch(dateRange, () => {
  if (isExpanded.value) {
    fetchStats()
  }
})

// Export statistics as CSV
function exportStats() {
  if (!stats.value) return

  // Build CSV content
  const lines: string[] = []

  // Header
  lines.push('Statistics Export')
  lines.push(`Date Range: ${dateRangeOptions.find(o => o.value === dateRange.value)?.label || dateRange.value}`)
  lines.push('')

  // Summary
  lines.push('Summary')
  lines.push(`Total Redirects,${stats.value.totalRedirects}`)
  lines.push(`Active Redirects,${stats.value.activeRedirects}`)
  lines.push(`Inactive Redirects,${stats.value.inactiveRedirects}`)
  lines.push(`Total Hits,${stats.value.totalHits}`)
  lines.push('')

  // Type breakdown
  lines.push('Type Breakdown')
  lines.push(`Simple,${stats.value.byType.simple || 0}`)
  lines.push(`Wildcard,${stats.value.byType.wildcard || 0}`)
  lines.push(`Regex,${stats.value.byType.regex || 0}`)
  lines.push('')

  // Daily hits
  lines.push('Daily Hits')
  lines.push('Date,Hits')
  stats.value.dailyHits.forEach(day => {
    lines.push(`${day.date},${day.count}`)
  })
  lines.push('')

  // Top redirects
  lines.push('Top Redirects')
  lines.push('Source Path,Hit Count')
  stats.value.topRedirects.forEach(r => {
    lines.push(`"${r.sourcePath}",${r.hitCount}`)
  })

  // Create and download file
  const csvContent = lines.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `statistics-${props.zoneId}-${dateRange.value}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Calculate max hits for chart scaling
const maxHits = computed(() => {
  if (!stats.value?.dailyHits) return 1
  return Math.max(1, ...stats.value.dailyHits.map(d => d.count))
})
</script>

<template>
  <div class="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Header (clickable to expand/collapse) -->
    <button
      class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span class="font-medium text-gray-900 dark:text-white">{{ t('windowsDns.redirects.stats.title') }}</span>
      </div>
      <svg
        class="w-5 h-5 text-gray-500 transition-transform"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Content (collapsible) -->
    <div v-if="isExpanded" class="border-t border-gray-200 dark:border-gray-700">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-6 flex items-center justify-center">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>

      <!-- Stats Content -->
      <div v-else-if="stats" class="p-4">
        <!-- Date Range Picker and Export Button -->
        <div class="mb-4 flex items-center justify-end gap-3">
          <button
            class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            @click="exportStats"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ t('windowsDns.redirects.stats.export') }}
          </button>
          <select
            v-model="dateRange"
            class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option v-for="option in dateRangeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('windowsDns.redirects.stats.total_redirects') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalRedirects }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('windowsDns.redirects.stats.active') }}</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.activeRedirects }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('windowsDns.redirects.stats.inactive') }}</p>
            <p class="text-2xl font-bold text-gray-500 dark:text-gray-400">{{ stats.inactiveRedirects }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('windowsDns.redirects.stats.total_hits') }}</p>
            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats.totalHits }}</p>
          </div>
        </div>

        <!-- Hits Chart (Simple Bar Chart) -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('windowsDns.redirects.stats.hits_over_time') }}</h4>
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <div class="flex items-end justify-between gap-1 h-32">
              <div
                v-for="(day, index) in stats.dailyHits"
                :key="day.date"
                class="flex-1 flex flex-col items-center group relative"
              >
                <div
                  class="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-300"
                  :style="{ height: `${Math.max(2, (day.count / maxHits) * 100)}%` }"
                  :title="`${day.date}: ${day.count} hits`"
                ></div>
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div class="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {{ day.date }}: {{ day.count }} hits
                  </div>
                </div>
              </div>
            </div>
            <div class="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ stats.dailyHits[0]?.date }}</span>
              <span>{{ stats.dailyHits[stats.dailyHits.length - 1]?.date }}</span>
            </div>
          </div>
        </div>

        <!-- Type Breakdown -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('windowsDns.redirects.stats.by_type') }}</h4>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-blue-500"></span>
                  {{ t('windowsDns.redirects.types.simple') }}
                </span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ stats.byType.simple || 0 }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-purple-500"></span>
                  {{ t('windowsDns.redirects.types.wildcard') }}
                </span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ stats.byType.wildcard || 0 }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-orange-500"></span>
                  {{ t('windowsDns.redirects.types.regex') }}
                </span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ stats.byType.regex || 0 }}</span>
              </div>
            </div>
          </div>

          <!-- Top Redirects -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('windowsDns.redirects.stats.top_redirects') }}</h4>
            <div class="space-y-2">
              <div
                v-for="redirect in stats.topRedirects"
                :key="redirect.id"
                class="flex items-center justify-between"
              >
                <span class="text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-[200px]">{{ redirect.sourcePath }}</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ redirect.hitCount }} hits</span>
              </div>
              <p v-if="stats.topRedirects.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('windowsDns.redirects.stats.no_hits_yet') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
