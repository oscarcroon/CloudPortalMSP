<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      @click.self="close"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header class="mb-4 space-y-1">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ zoneName }}
          </p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ t('cloudflareDns.import.title') }}
          </h3>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ t('cloudflareDns.import.description') }}
          </p>
        </header>

        <!-- Info box -->
        <div class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
          <p class="font-semibold">{{ t('cloudflareDns.import.info.title') }}</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-4">
            <li>{{ t('cloudflareDns.import.info.bullet1') }}</li>
            <li>{{ t('cloudflareDns.import.info.bullet2') }}</li>
            <li>{{ t('cloudflareDns.import.info.bullet3') }}</li>
          </ul>
        </div>

        <!-- File picker -->
        <div class="mb-4">
          <div
            v-if="!selectedFile"
            class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 transition hover:border-brand dark:border-slate-600 dark:hover:border-brand"
            @click="fileInput?.click()"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            :class="{ 'border-brand bg-brand/5': dragOver }"
          >
            <Icon icon="mdi:file-upload-outline" class="mb-2 h-8 w-8 text-slate-400 dark:text-slate-500" />
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ t('cloudflareDns.import.chooseFile') }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('cloudflareDns.import.dragDrop') }}
            </p>
            <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {{ t('cloudflareDns.import.fileHelp') }}
            </p>
          </div>

          <!-- File selected -->
          <div
            v-else
            class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <Icon icon="mdi:file-document-outline" class="h-6 w-6 text-brand" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                {{ selectedFile.name }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ formatFileSize(selectedFile.size) }}
              </p>
            </div>
            <button
              type="button"
              class="text-xs font-medium text-brand hover:underline"
              @click="clearFile"
            >
              {{ t('cloudflareDns.import.change') }}
            </button>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept=".txt,.bind,.zone"
            class="hidden"
            @change="handleFileSelect"
          />
        </div>

        <!-- Error -->
        <p v-if="error" class="mb-3 text-xs text-red-600 dark:text-red-400">{{ error }}</p>

        <!-- Success -->
        <p v-if="successMessage" class="mb-3 text-xs text-green-600 dark:text-green-400">{{ successMessage }}</p>

        <!-- Cloudflare warnings -->
        <div v-if="warnings.length" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <p class="font-semibold">{{ t('cloudflareDns.import.warnings') }}</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-4">
            <li v-for="(msg, i) in warnings" :key="i">{{ msg }}</li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" type="button" @click="close">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="!selectedFile || importing"
            @click="doImport"
          >
            <Icon v-if="importing" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <Icon v-else icon="mdi:file-import-outline" class="h-4 w-4" />
            {{ importing ? t('cloudflareDns.import.importing') : t('cloudflareDns.import.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from '#imports'

const props = defineProps<{
  isOpen: boolean
  zoneId: string
  zoneName: string
}>()

const emit = defineEmits<{
  close: []
  imported: [result: { recsAdded: number; totalRecordsParsed: number }]
}>()

const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const fileContent = ref<string | null>(null)
const importing = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const warnings = ref<string[]>([])
const dragOver = ref(false)

const MAX_FILE_SIZE = 1024 * 1024 // 1 MB
const ACCEPTED_EXTENSIONS = ['.txt', '.bind', '.zone']

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const isValidFileType = (file: File) => {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

const processFile = (file: File) => {
  error.value = null
  successMessage.value = null
  warnings.value = []

  if (!isValidFileType(file)) {
    error.value = t('cloudflareDns.import.invalidFileType')
    return
  }

  if (file.size > MAX_FILE_SIZE) {
    error.value = t('cloudflareDns.import.fileTooLarge')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    selectedFile.value = file
    fileContent.value = reader.result as string
  }
  reader.onerror = () => {
    error.value = t('cloudflareDns.import.readError')
  }
  reader.readAsText(file)
}

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) processFile(file)
  // Reset input so same file can be re-selected
  input.value = ''
}

const handleDrop = (e: DragEvent) => {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

const clearFile = () => {
  selectedFile.value = null
  fileContent.value = null
  error.value = null
  successMessage.value = null
  warnings.value = []
}

const close = () => {
  clearFile()
  importing.value = false
  emit('close')
}

const doImport = async () => {
  if (!fileContent.value || !selectedFile.value) return
  importing.value = true
  error.value = null
  successMessage.value = null
  warnings.value = []

  try {
    const res = await $fetch<{ success: boolean; recsAdded: number; totalRecordsParsed: number; messages?: string[] }>(
      `/api/dns/cloudflare/zones/${props.zoneId}/import`,
      {
        method: 'POST',
        body: {
          content: fileContent.value,
          filename: selectedFile.value.name
        }
      }
    )

    successMessage.value = t('cloudflareDns.import.success', {
      added: res.recsAdded,
      parsed: res.totalRecordsParsed
    })

    warnings.value = res.messages ?? []

    emit('imported', { recsAdded: res.recsAdded, totalRecordsParsed: res.totalRecordsParsed })
  } catch (err: any) {
    error.value = err?.data?.message ?? err?.message ?? t('cloudflareDns.import.error')
  } finally {
    importing.value = false
  }
}
</script>
