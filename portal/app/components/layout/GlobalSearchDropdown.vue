<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div
      v-if="globalSearch.isOpen.value && (globalSearch.query.value.trim().length > 0)"
      class="absolute left-0 right-0 top-full z-[70] mt-1 max-h-[400px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <!-- Loading -->
      <div v-if="globalSearch.loading.value && globalSearch.flatResults.value.length === 0" class="flex items-center gap-2 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{{ t('topBar.searchPlaceholder') }}</span>
      </div>

      <!-- No results -->
      <div
        v-else-if="!globalSearch.loading.value && globalSearch.flatResults.value.length === 0 && globalSearch.query.value.trim().length > 0"
        class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400"
      >
        {{ t('search.noResults') }}
      </div>

      <!-- Results grouped by category -->
      <div v-else>
        <div v-for="(items, category) in globalSearch.groupedResults.value" :key="category" class="border-b border-slate-100 last:border-b-0 dark:border-slate-700">
          <div class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {{ category }}
          </div>
          <ul>
            <li
              v-for="(result, idx) in items"
              :key="result.id"
              :class="[
                'flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition',
                flatIndex(category, idx) === globalSearch.selectedIndex.value
                  ? 'text-white'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50'
              ]"
              :style="flatIndex(category, idx) === globalSearch.selectedIndex.value ? { backgroundColor: accentColor } : {}"
              @mouseenter="globalSearch.selectedIndex.value = flatIndex(category, idx)"
              @click="navigate(result.route)"
            >
              <Icon v-if="result.icon" :icon="result.icon" class="h-4 w-4 flex-shrink-0" :class="flatIndex(category, idx) === globalSearch.selectedIndex.value ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">{{ result.title }}</div>
                <div v-if="result.description" class="truncate text-xs" :class="flatIndex(category, idx) === globalSearch.selectedIndex.value ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'">
                  {{ result.description }}
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Footer hints -->
      <div
        v-if="globalSearch.flatResults.value.length > 0"
        class="flex items-center gap-4 border-t border-slate-100 px-4 py-1.5 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500"
      >
        <span><kbd class="rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600">↑↓</kbd> {{ t('search.navigate') }}</span>
        <span><kbd class="rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600">↵</kbd> {{ t('search.select') }}</span>
        <span><kbd class="rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600">esc</kbd> {{ t('search.close') }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { useGlobalSearch } from '~/composables/useGlobalSearch'
import { useAuth } from '~/composables/useAuth'

const globalSearch = useGlobalSearch()
const auth = useAuth()
const { t } = useI18n()
const router = useRouter()

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const flatIndex = (category: string, indexInCategory: number): number => {
  const grouped = globalSearch.groupedResults.value
  let offset = 0
  for (const [cat, items] of Object.entries(grouped)) {
    if (cat === category) return offset + indexInCategory
    offset += items.length
  }
  return 0
}

const navigate = (route: string) => {
  router.push(route)
  globalSearch.close()
  globalSearch.query.value = ''
}
</script>
