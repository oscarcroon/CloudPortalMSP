<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
    <div class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900">
      <!-- Header -->
      <div class="border-b border-slate-200 p-4 dark:border-white/10">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('settings.audit.detailsModal.title') }}
          </h2>
          <button
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="close"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Content (scrollable) -->
      <div class="max-h-[calc(90vh-80px)] overflow-y-auto p-4 space-y-4">
        <!-- Event Type -->
        <div>
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.eventType') }}
          </label>
          <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">
            {{ log.eventType }}
          </p>
        </div>

        <!-- Request ID (if available) -->
        <div v-if="log.requestId">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.requestId') }}
          </label>
          <p class="mt-1 font-mono text-xs text-slate-600 dark:text-slate-400">
            {{ log.requestId }}
          </p>
        </div>

        <!-- Summary (if available) -->
        <div v-if="meta?.summary">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.summary') }}
          </label>
          <p class="mt-1 text-sm text-slate-900 dark:text-white">
            {{ meta.summary }}
          </p>
        </div>

        <!-- Operation (if available) -->
        <div v-if="meta?.operation">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.operation') }}
          </label>
          <span :class="operationBadgeClass" class="mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium">
            {{ operationLabel }}
          </span>
        </div>

        <!-- Changes table (if meta.changes exists) -->
        <div v-if="hasChanges">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.changes') }}
          </label>
          <div v-if="meta?.truncated" class="mt-1 mb-2 text-xs text-amber-600 dark:text-amber-400">
            {{ t('settings.audit.detailsModal.truncated') }}
          </div>
          <div class="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table class="w-full">
              <thead class="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    {{ t('settings.audit.detailsModal.field') }}
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    {{ t('settings.audit.detailsModal.previous') }}
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    {{ t('settings.audit.detailsModal.new') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-white/10">
                <tr v-for="(change, field) in (meta?.changes as Record<string, FieldChange> | undefined)" :key="field" class="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td class="px-3 py-2 text-sm font-medium text-slate-900 dark:text-white">
                    {{ field }}
                  </td>
                  <td class="px-3 py-2">
                    <code class="block max-w-[200px] overflow-x-auto whitespace-pre-wrap break-all rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{{ formatValue(change.from) }}</code>
                  </td>
                  <td class="px-3 py-2">
                    <code class="block max-w-[200px] overflow-x-auto whitespace-pre-wrap break-all rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">{{ formatValue(change.to) }}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Other metadata (excluding changes, operation, summary, truncated) -->
        <div v-if="hasOtherMeta">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.otherMetadata') }}
          </label>
          <pre class="mt-1 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-900 dark:bg-slate-800 dark:text-white">{{ JSON.stringify(otherMeta, null, 2) }}</pre>
        </div>

        <!-- Fallback: Show raw meta if no changes -->
        <div v-if="!hasChanges && !hasOtherMeta && meta">
          <label class="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            {{ t('settings.audit.detailsModal.metadata') }}
          </label>
          <pre class="mt-1 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-900 dark:bg-slate-800 dark:text-white">{{ JSON.stringify(meta, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from '#imports'
import { useI18n } from '#imports'

const { t } = useI18n()

interface AuditLog {
  id: string
  eventType: string
  requestId?: string | null
  meta?: Record<string, unknown> | null
  [key: string]: unknown
}

interface FieldChange {
  from: unknown
  to: unknown
}

const props = defineProps<{
  modelValue: boolean
  log: AuditLog
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const close = () => {
  emit('update:modelValue', false)
}

const meta = computed(() => props.log?.meta as Record<string, unknown> | null)

const hasChanges = computed(() => {
  return meta.value?.changes && typeof meta.value.changes === 'object' && Object.keys(meta.value.changes as object).length > 0
})

// Fields to exclude from "other metadata" display
const excludedMetaFields = ['changes', 'operation', 'summary', 'truncated']

const otherMeta = computed(() => {
  if (!meta.value) return null
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta.value)) {
    if (!excludedMetaFields.includes(key)) {
      filtered[key] = value
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null
})

const hasOtherMeta = computed(() => otherMeta.value !== null)

const operationLabel = computed(() => {
  const op = meta.value?.operation as string | undefined
  switch (op) {
    case 'create':
      return t('settings.audit.detailsModal.operationCreate')
    case 'update':
      return t('settings.audit.detailsModal.operationUpdate')
    case 'delete':
      return t('settings.audit.detailsModal.operationDelete')
    default:
      return op || ''
  }
})

const operationBadgeClass = computed(() => {
  const op = meta.value?.operation as string | undefined
  switch (op) {
    case 'create':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'update':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'delete':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
})

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}
</script>
