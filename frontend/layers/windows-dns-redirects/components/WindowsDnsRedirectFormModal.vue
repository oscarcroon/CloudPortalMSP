<script setup lang="ts">
/**
 * WindowsDnsRedirect Form Modal
 * Create or edit redirect rules with host support and presets
 */
import type { WindowsDnsRedirect } from '../../types'
import type { WindowsDnsRedirectErrorType } from '../composables/useWindowsDnsRedirectError'

const props = defineProps<{
  isOpen: boolean
  redirect?: WindowsDnsRedirect | null
  zoneId: string
  zoneName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', redirect: WindowsDnsRedirect): void
}>()

const { t } = useI18n()
const { parseError, getErrorType } = useWindowsDnsRedirectError()

const isEditing = computed(() => !!props.redirect)
const isSubmitting = ref(false)
const errorMessage = ref('')
const errorType = ref<WindowsDnsRedirectErrorType | null>(null)
const showRetry = ref(false)

type DnsConflictPayload = {
  recordName: string
  before: Array<{ id?: string; name: string; type: string; content: string; ttl?: number | null }>
  after: Array<{ name: string; type: string; content: string; ttl?: number | null }>
}

const dnsConflict = ref<DnsConflictPayload | null>(null)
const showDnsConflictModal = ref(false)

// Field-level error state
const fieldErrors = ref<{
  host: string
  sourcePath: string
  destinationUrl: string
}>({
  host: '',
  sourcePath: '',
  destinationUrl: '',
})

// Preset options
type PresetType = 'none' | 'domain_move'
const selectedPreset = ref<PresetType>('none')

// Form state
const form = ref({
  host: '',
  sourcePath: '',
  destinationUrl: '',
  redirectType: 'simple' as 'simple' | 'wildcard' | 'regex',
  statusCode: 301,
  isActive: true,
})

// Computed display host - shows effective host based on input
const displayHost = computed(() => {
  const h = form.value.host.trim()
  if (!h || h === '@') return props.zoneName
  if (h.includes('.')) return h
  return `${h}.${props.zoneName}`
})

// Reset form when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    errorMessage.value = ''
    errorType.value = null
    showRetry.value = false
    clearFieldErrors()
    if (props.redirect) {
      // Edit mode - populate form
      selectedPreset.value = 'none'
      // For display, show the subdomain label if host ends with zoneName
      let hostDisplay = props.redirect.host || ''
      if (hostDisplay === props.zoneName) {
        hostDisplay = '@'
      } else if (hostDisplay.endsWith(`.${props.zoneName}`)) {
        hostDisplay = hostDisplay.slice(0, -(props.zoneName.length + 1))
      }
      form.value = {
        host: hostDisplay,
        sourcePath: props.redirect.sourcePath,
        destinationUrl: props.redirect.destinationUrl,
        redirectType: props.redirect.redirectType,
        statusCode: props.redirect.statusCode,
        isActive: props.redirect.isActive,
      }
    } else {
      // Create mode - reset form with domain_move preset as default
      selectedPreset.value = 'domain_move'
      form.value = {
        host: '',
        sourcePath: '',
        destinationUrl: '',
        redirectType: 'simple',
        statusCode: 301,
        isActive: true,
      }
    }
  }
})

// Apply preset when selected
watch(selectedPreset, (preset) => {
  if (preset === 'domain_move') {
    // Preset fills in default values for domain move
    // Use '/*' for wildcard to match all paths including root (/)
    // In wildcard: '/*' matches both root and all sub-paths
    form.value.sourcePath = '/*'
    form.value.redirectType = 'wildcard'
    form.value.statusCode = 301
    form.value.isActive = true
    // Host stays as user input (will handle apex+www separately)
  }
})

// Status code options
const statusCodes = computed(() => [
  { value: 301, label: t('windowsDns.redirects.status_codes.301') },
  { value: 302, label: t('windowsDns.redirects.status_codes.302') },
  { value: 307, label: t('windowsDns.redirects.status_codes.307') },
  { value: 308, label: t('windowsDns.redirects.status_codes.308') },
])

// Status code help text based on selected code
const statusCodeHelp = computed(() => {
  switch (form.value.statusCode) {
    case 301:
      return t('windowsDns.redirects.form.status_code_help_301')
    case 302:
      return t('windowsDns.redirects.form.status_code_help_302')
    case 307:
      return t('windowsDns.redirects.form.status_code_help_307')
    case 308:
      return t('windowsDns.redirects.form.status_code_help_308')
    default:
      return t('windowsDns.redirects.form.status_code_help')
  }
})

// Type options
const redirectTypes = computed(() => [
  { value: 'simple', label: t('windowsDns.redirects.types.simple'), description: t('windowsDns.redirects.types.simple_description') },
  { value: 'wildcard', label: t('windowsDns.redirects.types.wildcard'), description: t('windowsDns.redirects.types.wildcard_description') },
  { value: 'regex', label: t('windowsDns.redirects.types.regex'), description: t('windowsDns.redirects.types.regex_description') },
])

// Dynamic examples based on redirect type
const sourcePathExample = computed(() => {
  switch (form.value.redirectType) {
    case 'simple':
      return '/gammal-sida'
    case 'wildcard':
      return '/produkter/*'
    case 'regex':
      return '^/blog/(.+)$'
    default:
      return '/gammal-sida'
  }
})

const destinationUrlExample = computed(() => {
  switch (form.value.redirectType) {
    case 'simple':
      return 'https://example.com/ny-sida'
    case 'wildcard':
      return 'https://example.com/shop/*'
    case 'regex':
      return 'https://example.com/articles/$1'
    default:
      return 'https://example.com/ny-sida'
  }
})

const sourcePathHelp = computed(() => {
  switch (form.value.redirectType) {
    case 'simple':
      return t('windowsDns.redirects.form.source_path_help_simple')
    case 'wildcard':
      return t('windowsDns.redirects.form.source_path_help_wildcard')
    case 'regex':
      return t('windowsDns.redirects.form.source_path_help_regex')
    default:
      return t('windowsDns.redirects.form.source_path_help')
  }
})

const destinationUrlHelp = computed(() => {
  switch (form.value.redirectType) {
    case 'simple':
      return t('windowsDns.redirects.form.destination_url_help_simple')
    case 'wildcard':
      return t('windowsDns.redirects.form.destination_url_help_wildcard')
    case 'regex':
      return t('windowsDns.redirects.form.destination_url_help_regex')
    default:
      return t('windowsDns.redirects.form.destination_url_help')
  }
})

// Clear field errors
function clearFieldErrors() {
  fieldErrors.value = {
    host: '',
    sourcePath: '',
    destinationUrl: '',
  }
}

// Form validation - returns true if valid, false if errors
function validateForm(): boolean {
  clearFieldErrors()
  let isValid = true

  // Validate host (basic client-side check; server normalizes fully)
  const hostInput = form.value.host.trim()
  if (hostInput && hostInput !== '@') {
    // If it contains dots, must end with zoneName
    if (hostInput.includes('.') && !hostInput.endsWith(props.zoneName)) {
      fieldErrors.value.host = t('windowsDns.redirects.validation.host_invalid')
      isValid = false
    }
  }

  // Validate source path
  // Empty or "/" means root, otherwise must start with /
  const sourcePath = form.value.sourcePath.trim()
  if (sourcePath && sourcePath !== '/' && !sourcePath.startsWith('/')) {
    fieldErrors.value.sourcePath = t('windowsDns.redirects.validation.source_format')
    isValid = false
  } else if (form.value.redirectType === 'regex' && sourcePath) {
    // Validate regex syntax for regex type redirects
    try {
      new RegExp(sourcePath)
    } catch (e) {
      fieldErrors.value.sourcePath = t('windowsDns.redirects.validation.invalid_regex')
      isValid = false
    }
  }

  // Validate destination URL
  if (!form.value.destinationUrl) {
    fieldErrors.value.destinationUrl = t('windowsDns.redirects.validation.destination_required')
    isValid = false
  } else {
    try {
      new URL(form.value.destinationUrl)
    } catch {
      fieldErrors.value.destinationUrl = t('windowsDns.redirects.validation.destination_format')
      isValid = false
    }
  }

  return isValid
}

// Clear error state
function clearError() {
  errorMessage.value = ''
  errorType.value = null
  showRetry.value = false
}

function clearDnsConflict() {
  dnsConflict.value = null
  showDnsConflictModal.value = false
}

function extractDnsConflict(error: any): DnsConflictPayload | null {
  const data = error?.data?.data || error?.response?._data?.data
  if (!data || data.code !== 'DNS_RECORD_CONFLICT') return null
  if (!data.recordName || !Array.isArray(data.before) || !Array.isArray(data.after)) return null
  return {
    recordName: data.recordName,
    before: data.before,
    after: data.after,
  }
}

// Build request body
function buildRequestBody(applyDnsChanges = false) {
  // Normalize source path: empty means root "/"
  const sourcePath = form.value.sourcePath.trim() || '/'
  return {
    host: form.value.host.trim() || '@',
    sourcePath,
    destinationUrl: form.value.destinationUrl,
    redirectType: form.value.redirectType,
    statusCode: form.value.statusCode,
    isActive: form.value.isActive,
    applyDnsChanges,
  }
}

// Submit form (handles domain move preset with multiple redirects)
async function handleSubmit() {
  clearError()
  clearDnsConflict()

  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    // Domain move preset: create both apex and www redirects
    if (!isEditing.value && selectedPreset.value === 'domain_move') {
      const results: WindowsDnsRedirect[] = []

      // Create apex redirect
      const apexBody = {
        ...buildRequestBody(),
        host: '@',
      }
      const apexResponse = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects`, {
        method: 'POST',
        body: apexBody,
      })
      results.push(apexResponse.redirect)

      // Create www redirect
      const wwwBody = {
        ...buildRequestBody(),
        host: 'www',
      }
      const wwwResponse = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects`, {
        method: 'POST',
        body: wwwBody,
      })
      results.push(wwwResponse.redirect)

      // Emit first redirect (apex) as the "saved" one
      emit('saved', results[0])
      emit('close')
      return
    }

    // Normal single redirect
    let response
    if (isEditing.value && props.redirect) {
      // Update existing redirect
      response = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects/${props.redirect.id}`, {
        method: 'PATCH',
        body: buildRequestBody(),
      })
    } else {
      // Create new redirect
      response = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects`, {
        method: 'POST',
        body: buildRequestBody(),
      })
    }

    emit('saved', response.redirect)
    emit('close')
  } catch (error: any) {
    // DNS conflict flow: show before/after warning and require explicit confirmation
    const conflict = extractDnsConflict(error)
    if (conflict) {
      dnsConflict.value = conflict
      showDnsConflictModal.value = true
      return
    }

    // Parse the error and show user-friendly message
    const parsedError = parseError(error)
    errorType.value = parsedError.type
    errorMessage.value = parsedError.message
    showRetry.value = parsedError.canRetry

    // Log for debugging (no technical details shown to user)
    console.error('Failed to save redirect:', error)
  } finally {
    isSubmitting.value = false
  }
}

async function confirmApplyDnsChangesAndSubmit() {
  if (!dnsConflict.value) return
  clearError()

  isSubmitting.value = true
  try {
    let response
    if (isEditing.value && props.redirect) {
      response = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects/${props.redirect.id}`, {
        method: 'PATCH',
        body: buildRequestBody(true),
      })
    } else {
      response = await $fetch(`/api/dns/windows/zones/${props.zoneId}/redirects`, {
        method: 'POST',
        body: buildRequestBody(true),
      })
    }
    emit('saved', response.redirect)
    emit('close')
  } catch (error: any) {
    // If conflict persists (e.g. race), keep showing modal; otherwise show error alert
    const conflict = extractDnsConflict(error)
    if (conflict) {
      dnsConflict.value = conflict
      showDnsConflictModal.value = true
      return
    }
    const parsedError = parseError(error)
    errorType.value = parsedError.type
    errorMessage.value = parsedError.message
    showRetry.value = parsedError.canRetry
    console.error('Failed to save redirect after applying DNS changes:', error)
  } finally {
    isSubmitting.value = false
  }
}

// Retry submission
function handleRetry() {
  handleSubmit()
}

// Close modal
function handleClose() {
  if (!isSubmitting.value) {
    clearDnsConflict()
    emit('close')
  }
}

// Handle keyboard events for modal
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !isSubmitting.value) {
    handleClose()
  }
}

// Add/remove keyboard listener when modal opens/closes (client-side only)
if (import.meta.client) {
  watch(() => props.isOpen, (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
</script>

<template>
  <Teleport to="body">
    <WindowsDnsRedirectDnsConflictModal
      v-if="dnsConflict"
      :is-open="showDnsConflictModal"
      :record-name="dnsConflict.recordName"
      :before="dnsConflict.before"
      :after="dnsConflict.after"
      :is-applying="isSubmitting"
      @close="clearDnsConflict"
      @confirm="confirmApplyDnsChangesAndSubmit"
    />
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
          class="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ isEditing ? t('windowsDns.redirects.form.edit_title') : t('windowsDns.redirects.form.create_title') }}
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
          <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
            <!-- Error Alert with Retry -->
            <WindowsDnsRedirectErrorAlert
              v-if="errorMessage"
              :type="errorType || 'generic'"
              :message="errorMessage"
              :show-retry="showRetry"
              :is-retrying="isSubmitting"
              @retry="handleRetry"
              @dismiss="clearError"
            />

            <!-- Preset selector (only for create mode) -->
            <div v-if="!isEditing">
              <label for="preset" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.preset_label') }}
              </label>
              <select
                id="preset"
                v-model="selectedPreset"
                class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">{{ t('windowsDns.redirects.form.preset_none') }}</option>
                <option value="domain_move">{{ t('windowsDns.redirects.form.preset_domain_move') }}</option>
              </select>
              <p v-if="selectedPreset === 'domain_move'" class="mt-1 text-xs text-blue-600 dark:text-blue-400">
                {{ t('windowsDns.redirects.form.preset_domain_move_description') }}
              </p>
            </div>

            <!-- Host (hide when using domain_move preset since it creates both apex and www) -->
            <div v-if="selectedPreset !== 'domain_move'">
              <label for="host" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.host') }}
              </label>
              <div class="relative">
                <input
                  id="host"
                  v-model="form.host"
                  type="text"
                  :placeholder="t('windowsDns.redirects.form.host_placeholder')"
                  :class="[
                    'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm',
                    fieldErrors.host
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  ]"
                  @input="fieldErrors.host = ''"
                />
              </div>
              <p v-if="fieldErrors.host" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ fieldErrors.host }}
              </p>
              <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('windowsDns.redirects.form.host_help', { zoneName }) }}
                <span v-if="form.host" class="font-medium"> → {{ displayHost }}</span>
              </p>
            </div>

            <!-- Source Path -->
            <div>
              <label for="sourcePath" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.source_path') }}
              </label>
              <input
                id="sourcePath"
                v-model="form.sourcePath"
                type="text"
                :placeholder="sourcePathExample"
                :class="[
                  'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm',
                  fieldErrors.sourcePath
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                ]"
                @input="fieldErrors.sourcePath = ''"
              />
              <p v-if="fieldErrors.sourcePath" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ fieldErrors.sourcePath }}
              </p>
              <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ sourcePathHelp }}
                <span class="block mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
                  Exempel: {{ sourcePathExample }}
                </span>
              </p>
            </div>

            <!-- Destination URL -->
            <div>
              <label for="destinationUrl" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.destination_url') }}
              </label>
              <input
                id="destinationUrl"
                v-model="form.destinationUrl"
                type="text"
                :placeholder="destinationUrlExample"
                :class="[
                  'w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm',
                  fieldErrors.destinationUrl
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                ]"
                @input="fieldErrors.destinationUrl = ''"
              />
              <p v-if="fieldErrors.destinationUrl" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ fieldErrors.destinationUrl }}
              </p>
              <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ destinationUrlHelp }}
                <span class="block mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
                  Exempel: {{ destinationUrlExample }}
                </span>
              </p>
            </div>

            <!-- Redirect Type (hide in domain_move preset since it's always wildcard) -->
            <fieldset v-if="selectedPreset !== 'domain_move'">
              <legend class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.redirect_type') }}
              </legend>
              <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Redirect Type">
                <button
                  v-for="type in redirectTypes"
                  :key="type.value"
                  type="button"
                  :class="[
                    'p-2 text-center border rounded-lg text-sm transition-colors',
                    form.redirectType === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  ]"
                  @click="form.redirectType = type.value as any"
                >
                  {{ type.label }}
                </button>
              </div>
            </fieldset>

            <!-- Status Code -->
            <div>
              <label for="statusCode" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('windowsDns.redirects.form.status_code') }}
              </label>
              <select
                id="statusCode"
                v-model="form.statusCode"
                class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option v-for="code in statusCodes" :key="code.value" :value="code.value">
                  {{ code.label }}
                </option>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ statusCodeHelp }}
              </p>
            </div>

            <!-- Active Toggle -->
            <div class="flex items-center">
              <input
                id="isActive"
                v-model="form.isActive"
                type="checkbox"
                class="h-4 w-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
              />
              <label for="isActive" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                {{ t('windowsDns.redirects.form.is_active') }}
              </label>
            </div>
          </form>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="isSubmitting"
              @click="handleClose"
            >
              {{ t('windowsDns.redirects.form.cancel') }}
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              :disabled="isSubmitting"
              @click="handleSubmit"
            >
              <span v-if="isSubmitting" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('windowsDns.redirects.form.save') }}...
              </span>
              <span v-else>
                {{ isEditing ? t('windowsDns.redirects.form.update') : t('windowsDns.redirects.form.create') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
