<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
    <div class="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ title }}</h2>
          <p v-if="subject" class="text-sm text-slate-500 dark:text-slate-400">Ämne: {{ subject }}</p>
        </div>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
          @click="close"
        >
          <Icon icon="mdi:close" class="h-5 w-5" />
        </button>
      </div>
      <div class="overflow-y-auto p-6" style="max-height: calc(90vh - 80px)">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="text-sm text-slate-500 dark:text-slate-400">Laddar förhandsvisning...</div>
        </div>
        <div v-else-if="error" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {{ error }}
        </div>
        <div v-else-if="html" class="email-preview">
          <iframe
            :srcdoc="html"
            class="h-full w-full border-0"
            style="min-height: 600px"
            title="E-postförhandsvisning"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  isOpen: boolean
  title: string
  type: 'invitation' | 'password-reset'
  organizationId?: string | null
  tenantId?: string | null
  disclaimerMarkdown?: string | null
  isDarkMode?: boolean | null
  emailLanguage?: 'sv' | 'en' | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const loading = ref(false)
const error = ref('')
const html = ref('')
const subject = ref('')

const close = () => {
  emit('close')
  html.value = ''
  subject.value = ''
  error.value = ''
}

watch(
  () => props.isOpen,
  async (newValue) => {
    if (newValue) {
      // Always load preview with latest values when modal opens
      await loadPreview()
    } else {
      close()
    }
  }
)

// Track previous values to detect changes
const previousDarkMode = ref<boolean | null | undefined>(undefined)
const previousDisclaimer = ref<string | null | undefined>(undefined)
const previousLanguage = ref<'sv' | 'en' | null | undefined>(undefined)

// Reload preview when isDarkMode changes (only if modal is open)
watch(
  () => props.isDarkMode,
  async (newValue) => {
    // Only reload if modal is open and value actually changed
    if (props.isOpen && previousDarkMode.value !== undefined && newValue !== previousDarkMode.value) {
      await loadPreview()
    }
    previousDarkMode.value = newValue
  }
)

// Reload preview when disclaimerMarkdown changes (only if modal is open)
watch(
  () => props.disclaimerMarkdown,
  async (newValue) => {
    // Only reload if modal is open and value actually changed
    if (props.isOpen && previousDisclaimer.value !== undefined && newValue !== previousDisclaimer.value) {
      await loadPreview()
    }
    previousDisclaimer.value = newValue
  }
)

// Initialize previous values when modal opens
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      previousDarkMode.value = props.isDarkMode
      previousDisclaimer.value = props.disclaimerMarkdown
      previousLanguage.value = props.emailLanguage ?? 'sv'
    }
  }
)

// Reload preview when emailLanguage changes (only if modal is open)
watch(
  () => props.emailLanguage,
  async (newValue) => {
    if (props.isOpen && previousLanguage.value !== undefined && newValue !== previousLanguage.value) {
      await loadPreview()
    }
    previousLanguage.value = newValue ?? 'sv'
  }
)

const loadPreview = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<{ subject: string; html: string; text: string }>(
      '/api/admin/email-provider/preview',
      {
        method: 'POST',
        body: {
          type: props.type,
          organizationId: props.organizationId,
          tenantId: props.tenantId,
          disclaimerMarkdown: props.disclaimerMarkdown,
          isDarkMode: props.isDarkMode !== undefined ? props.isDarkMode : null,
          emailLanguage: props.emailLanguage ?? null
        }
      }
    )
    subject.value = response.subject
    html.value = response.html
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Kunde inte ladda förhandsvisning.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.email-preview {
  background: #f7f9fc;
  border-radius: 8px;
  padding: 20px;
}
</style>

