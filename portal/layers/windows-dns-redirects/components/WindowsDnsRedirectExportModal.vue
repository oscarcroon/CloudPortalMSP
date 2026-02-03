<script setup lang="ts">
/**
 * WindowsDnsRedirect Export Modal
 * Export redirects to CSV or TXT format
 */
import type { WindowsDnsRedirectFilters } from '../types'

const props = defineProps<{
  isOpen: boolean
  zoneId: string
  filters?: WindowsDnsRedirectFilters
  hasActiveFilters?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const isExporting = ref(false)
const selectedFormat = ref<'csv' | 'txt'>('csv')
const exportScope = ref<'all' | 'filtered'>('all')

// Format options
const formatOptions = [
  { value: 'csv', label: 'CSV (Comma Separated)', description: 'Best for importing into spreadsheets' },
  { value: 'txt', label: 'Text (One per line)', description: 'Simple text format for reference' },
]

// Build export URL with optional filters
function buildExportUrl(includeFilters: boolean): string {
  const params = new URLSearchParams()
  params.set('format', selectedFormat.value)

  if (includeFilters && props.filters) {
    if (props.filters.search) params.set('search', props.filters.search)
    if (props.filters.type) params.set('type', props.filters.type)
    if (props.filters.statusCode) params.set('statusCode', String(props.filters.statusCode))
    if (props.filters.isActive !== undefined) params.set('isActive', String(props.filters.isActive))
  }

  return `/api/dns/windows/zones/${props.zoneId}/redirects/export?${params.toString()}`
}

// Handle export
async function handleExport(scope: 'all' | 'filtered') {
  isExporting.value = true

  try {
    const url = buildExportUrl(scope === 'filtered')

    const link = document.createElement('a')
    link.href = url
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      emit('close')
    }, 500)
  } catch (error) {
    console.error('Export failed:', error)
  } finally {
    isExporting.value = false
  }
}

// Close modal
function handleClose() {
  if (!isExporting.value) {
    emit('close')
  }
}

// Reset format when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    selectedFormat.value = 'csv'
    exportScope.value = 'all'
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="handleClose"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 transition-opacity" @click="handleClose"></div>

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('windowsDns.redirects.export.title') }}
            </h3>
            <button
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              @click="handleClose"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 space-y-4">
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              {{ t('windowsDns.redirects.export.description') }}
            </p>

            <!-- Format Selection -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Format</label>
              <label
                v-for="option in formatOptions"
                :key="option.value"
                :class="[
                  'flex items-start p-3 border rounded-lg cursor-pointer transition-colors',
                  selectedFormat === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                ]"
              >
                <input
                  v-model="selectedFormat"
                  type="radio"
                  :value="option.value"
                  class="mt-1 text-blue-500"
                />
                <div class="ml-3">
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ option.label }}
                  </span>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ option.description }}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="isExporting"
              @click="handleClose"
            >
              {{ t('windowsDns.redirects.form.cancel') }}
            </button>
            <!-- Export Current View button (only if filters are active) -->
            <button
              v-if="hasActiveFilters"
              type="button"
              class="px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
              :disabled="isExporting"
              @click="handleExport('filtered')"
            >
              <span v-if="isExporting" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('windowsDns.redirects.export.downloading') }}
              </span>
              <span v-else>
                {{ t('windowsDns.redirects.export.export_filtered') }}
              </span>
            </button>
            <!-- Export All button -->
            <button
              type="button"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              :disabled="isExporting"
              @click="handleExport('all')"
            >
              <span v-if="isExporting && !hasActiveFilters" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('windowsDns.redirects.export.downloading') }}
              </span>
              <span v-else>
                {{ t('windowsDns.redirects.export.export_all') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
