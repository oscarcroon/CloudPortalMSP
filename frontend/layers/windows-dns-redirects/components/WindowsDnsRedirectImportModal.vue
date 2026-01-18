<script setup lang="ts">
/**
 * WindowsDnsRedirect Import Modal
 * Import redirects from CSV/TXT file
 */

const props = defineProps<{
  isOpen: boolean
  zoneId: string
  zoneName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported', count: number): void
}>()

const { t } = useI18n()

// State
const isLoading = ref(false)
const isImporting = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const skipDuplicates = ref(true)

// Progress tracking
const importProgress = ref(0)
const importedCount = ref(0)
const progressInterval = ref<ReturnType<typeof setInterval> | null>(null)

// Parsed data for preview
const parsedRows = ref<Array<{
  sourcePath: string
  destinationUrl: string
  redirectType: string
  statusCode: number
  isActive: boolean
  valid: boolean
  error?: string
}>>([])

// Computed
const validRowCount = computed(() => parsedRows.value.filter(r => r.valid).length)
const invalidRowCount = computed(() => parsedRows.value.filter(r => !r.valid).length)

// Detect file format and parse accordingly
function parseFileContent(content: string): void {
  const lines = content.trim().split('\n')
  if (lines.length === 0) {
    errorMessage.value = 'File is empty'
    return
  }

  // Detect format: CSV (has commas) or TXT (space-separated)
  const firstContentLine = lines.find(l => l.trim() && !l.toLowerCase().includes('source'))
  const isCSV = firstContentLine ? firstContentLine.includes(',') : false

  if (isCSV) {
    parseCSV(content)
  } else {
    parseTXT(content)
  }
}

// Parse plain text format (space-separated: /source https://destination)
function parseTXT(content: string): void {
  const lines = content.trim().split('\n')
  parsedRows.value = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const parts = line.split(/\s+/)

    if (parts.length < 2) {
      parsedRows.value.push({
        sourcePath: parts[0] || '',
        destinationUrl: '',
        redirectType: 'simple',
        statusCode: 301,
        isActive: true,
        valid: false,
        error: 'Missing destination URL',
      })
      continue
    }

    const sourcePath = parts[0].trim()
    const destinationUrl = parts[1].trim()
    const redirectType = (parts[2] || 'simple').trim().toLowerCase()
    const statusCode = parseInt(parts[3]) || 301

    let valid = true
    let error = ''

    if (!sourcePath) {
      valid = false
      error = 'Source path is required'
    } else if (!sourcePath.startsWith('/')) {
      valid = false
      error = 'Source path must start with /'
    } else if (!destinationUrl) {
      valid = false
      error = 'Destination URL is required'
    } else {
      try {
        new URL(destinationUrl)
      } catch {
        valid = false
        error = 'Invalid destination URL'
      }
    }

    if (valid && !['simple', 'wildcard', 'regex'].includes(redirectType)) {
      valid = false
      error = `Invalid type: ${redirectType}`
    }

    if (valid && ![301, 302, 307, 308].includes(statusCode)) {
      valid = false
      error = `Invalid status code: ${statusCode}`
    }

    parsedRows.value.push({
      sourcePath,
      destinationUrl,
      redirectType,
      statusCode,
      isActive: true,
      valid,
      error,
    })
  }

  if (parsedRows.value.length === 0) {
    errorMessage.value = 'No valid rows found in file'
  }
}

// Parse CSV content
function parseCSV(content: string): void {
  const lines = content.trim().split('\n')
  if (lines.length === 0) {
    errorMessage.value = 'File is empty'
    return
  }

  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('source') || firstLine.includes('destination') || firstLine.includes('path')
  const startIndex = hasHeader ? 1 : 0

  parsedRows.value = []

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)

    if (fields.length < 2) {
      parsedRows.value.push({
        sourcePath: fields[0] || '',
        destinationUrl: '',
        redirectType: 'simple',
        statusCode: 301,
        isActive: true,
        valid: false,
        error: 'Missing destination URL',
      })
      continue
    }

    const sourcePath = fields[0].trim()
    const destinationUrl = fields[1].trim()
    const redirectType = (fields[2] || 'simple').trim().toLowerCase()
    const statusCode = parseInt(fields[3]) || 301
    const isActive = fields[4] ? fields[4].trim().toLowerCase() !== 'false' : true

    let valid = true
    let error = ''

    if (!sourcePath) {
      valid = false
      error = 'Source path is required'
    } else if (!sourcePath.startsWith('/')) {
      valid = false
      error = 'Source path must start with /'
    } else if (!destinationUrl) {
      valid = false
      error = 'Destination URL is required'
    } else {
      try {
        new URL(destinationUrl)
      } catch {
        valid = false
        error = 'Invalid destination URL'
      }
    }

    if (valid && !['simple', 'wildcard', 'regex'].includes(redirectType)) {
      valid = false
      error = `Invalid type: ${redirectType}`
    }

    if (valid && ![301, 302, 307, 308].includes(statusCode)) {
      valid = false
      error = `Invalid status code: ${statusCode}`
    }

    parsedRows.value.push({
      sourcePath,
      destinationUrl,
      redirectType,
      statusCode,
      isActive,
      valid,
      error,
    })
  }

  if (parsedRows.value.length === 0) {
    errorMessage.value = 'No valid rows found in file'
  }
}

// Parse a single CSV line
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields
}

// Handle file selection
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  selectedFile.value = file
  errorMessage.value = ''
  parsedRows.value = []

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    parseFileContent(content)
  }
  reader.onerror = () => {
    errorMessage.value = 'Failed to read file'
  }
  reader.readAsText(file)
}

// Start progress animation
function startProgressAnimation(totalRows: number) {
  importProgress.value = 0
  importedCount.value = 0

  const estimatedTimePerRow = 50
  const totalEstimatedTime = totalRows * estimatedTimePerRow
  const updateInterval = 100
  const progressPerUpdate = (100 / (totalEstimatedTime / updateInterval)) * 0.9

  progressInterval.value = setInterval(() => {
    if (importProgress.value < 90) {
      importProgress.value = Math.min(90, importProgress.value + progressPerUpdate)
      importedCount.value = Math.floor((importProgress.value / 100) * totalRows)
    }
  }, updateInterval)
}

// Stop progress animation
function stopProgressAnimation(actualImported: number, totalRows: number) {
  if (progressInterval.value) {
    clearInterval(progressInterval.value)
    progressInterval.value = null
  }
  importProgress.value = 100
  importedCount.value = actualImported
}

// Handle import
async function handleImport() {
  if (validRowCount.value === 0) return
  if (isImporting.value) return

  isImporting.value = true
  errorMessage.value = ''

  const totalRows = validRowCount.value
  startProgressAnimation(totalRows)

  try {
    const rows = parsedRows.value
      .filter(r => r.valid)
      .map(r => ({
        sourcePath: r.sourcePath,
        destinationUrl: r.destinationUrl,
        redirectType: r.redirectType,
        statusCode: r.statusCode,
        isActive: r.isActive,
      }))

    const response = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects/import`, {
      method: 'POST',
      body: {
        rows,
        zoneName: props.zoneName,
        skipDuplicates: skipDuplicates.value,
        filename: selectedFile.value?.name || 'import.csv',
      },
    })

    stopProgressAnimation(response.imported, totalRows)

    await new Promise(resolve => setTimeout(resolve, 500))

    if (response.success) {
      emit('imported', response.imported)
      emit('close')
    }
  } catch (error: any) {
    stopProgressAnimation(0, totalRows)
    errorMessage.value = error.data?.message || 'Import failed'
    console.error('Import failed:', error)
  } finally {
    isImporting.value = false
  }
}

// Close modal
function handleClose() {
  if (!isImporting.value) {
    emit('close')
  }
}

// Download sample file
function downloadSampleFile() {
  const sampleCSV = `sourcePath,destinationUrl,redirectType,statusCode,isActive
/old-page,https://example.com/new-page,simple,301,true
/products/*,https://example.com/shop/*,wildcard,302,true
^/blog/(.+)$,https://example.com/articles/$1,regex,301,true
/redirect-me,https://example.com/target,simple,307,false`

  const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'redirects-example.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Reset state when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    selectedFile.value = null
    parsedRows.value = []
    errorMessage.value = ''
    skipDuplicates.value = true
    importProgress.value = 0
    importedCount.value = 0
    if (progressInterval.value) {
      clearInterval(progressInterval.value)
      progressInterval.value = null
    }
    if (fileInput.value) {
      fileInput.value.value = ''
    }
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
          class="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('windowsDns.redirects.import.title') }}
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
            <!-- Error Message -->
            <div
              v-if="errorMessage"
              class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm"
            >
              {{ errorMessage }}
            </div>

            <!-- File Upload -->
            <div v-if="parsedRows.length === 0">
              <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">
                {{ t('windowsDns.redirects.import.description') }}
              </p>

              <!-- Format explanation -->
              <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <div class="flex items-start justify-between mb-2">
                  <p class="font-medium text-blue-900 dark:text-blue-200">
                    {{ t('windowsDns.redirects.import.format_title') }}
                  </p>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                    @click="downloadSampleFile"
                  >
                    <svg class="inline-block w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {{ t('windowsDns.redirects.import.download_sample') }}
                  </button>
                </div>
                <div class="text-blue-800 dark:text-blue-300 space-y-2 text-xs">
                  <div>
                    <p class="font-semibold mb-1">CSV-format:</p>
                    <p class="mb-1">{{ t('windowsDns.redirects.import.format_csv') }}</p>
                    <p class="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded break-all">sourcePath,destinationUrl,redirectType,statusCode,isActive</p>
                  </div>
                  <div>
                    <p class="font-semibold mb-1">TXT-format:</p>
                    <p class="mb-1">{{ t('windowsDns.redirects.import.format_txt') }}</p>
                    <p class="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded">/old-page https://example.com/new-page simple 301</p>
                  </div>
                </div>
              </div>

              <label class="block">
                <span class="sr-only">{{ t('windowsDns.redirects.import.file_label') }}</span>
                <div
                  class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  @click="fileInput?.click()"
                >
                  <svg class="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p class="text-gray-600 dark:text-gray-400">{{ t('windowsDns.redirects.import.drag_drop') }}</p>
                  <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">{{ t('windowsDns.redirects.import.file_help') }}</p>
                </div>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".csv,.txt"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </label>
            </div>

            <!-- Preview -->
            <div v-else>
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium text-gray-900 dark:text-white">
                  {{ t('windowsDns.redirects.import.preview_title') }}
                </h4>
                <div class="flex items-center gap-4 text-sm">
                  <span class="text-green-600 dark:text-green-400">{{ validRowCount }} valid</span>
                  <span v-if="invalidRowCount > 0" class="text-red-600 dark:text-red-400">{{ invalidRowCount }} invalid</span>
                </div>
              </div>

              <!-- Skip duplicates option -->
              <div class="flex items-center mb-3">
                <input
                  id="skipDuplicates"
                  v-model="skipDuplicates"
                  type="checkbox"
                  class="h-4 w-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <label for="skipDuplicates" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {{ t('windowsDns.redirects.import.skip_duplicates') }}
                </label>
              </div>

              <!-- Preview table -->
              <div class="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Source</th>
                      <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Destination</th>
                      <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Type</th>
                      <th class="px-3 py-2 text-left text-gray-600 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, index) in parsedRows"
                      :key="index"
                      :class="[
                        'border-t border-gray-100 dark:border-gray-700',
                        row.valid ? '' : 'bg-red-50 dark:bg-red-900/20'
                      ]"
                    >
                      <td class="px-3 py-2 font-mono text-xs">
                        {{ row.sourcePath }}
                        <span v-if="row.error" class="block text-red-600 dark:text-red-400 text-xs">{{ row.error }}</span>
                      </td>
                      <td class="px-3 py-2 font-mono text-xs truncate max-w-xs">{{ row.destinationUrl }}</td>
                      <td class="px-3 py-2">{{ row.redirectType }}</td>
                      <td class="px-3 py-2">
                        <span v-if="row.valid" class="text-green-600 dark:text-green-400">Ready</span>
                        <span v-else class="text-red-600 dark:text-red-400">Error</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Change file button -->
              <button
                class="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                @click="parsedRows = []; selectedFile = null"
              >
                {{ t('windowsDns.redirects.import.choose_different') }}
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="isImporting"
              @click="handleClose"
            >
              {{ t('windowsDns.redirects.form.cancel') }}
            </button>
            <!-- Progress indicator during import -->
            <div v-if="isImporting" class="flex-1 mr-4">
              <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>{{ t('windowsDns.redirects.import.importing') }}</span>
                <span>{{ importedCount }} / {{ validRowCount }}</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  class="bg-blue-500 h-2 rounded-full transition-all duration-100"
                  :style="{ width: `${importProgress}%` }"
                ></div>
              </div>
            </div>
            <button
              v-if="parsedRows.length > 0"
              type="button"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              :disabled="isImporting || validRowCount === 0"
              @click="handleImport"
            >
              <span v-if="isImporting" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('windowsDns.redirects.import.importing') }}
              </span>
              <span v-else>
                {{ t('windowsDns.redirects.import.confirm') }} ({{ validRowCount }})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
