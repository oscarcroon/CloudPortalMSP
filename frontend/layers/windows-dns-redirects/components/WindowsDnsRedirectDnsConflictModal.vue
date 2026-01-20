<script setup lang="ts">
type DnsRecord = {
  id?: string
  name: string
  type: string
  content: string
  ttl?: number | null
}

const props = defineProps<{
  isOpen: boolean
  recordName: string
  before: DnsRecord[]
  after: DnsRecord[]
  isApplying?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()
const confirmAck = ref(false)

watch(() => props.isOpen, (open) => {
  if (open) confirmAck.value = false
})

function handleClose() {
  if (!props.isApplying) emit('close')
}

function handleConfirm() {
  if (!confirmAck.value || props.isApplying) return
  emit('confirm')
}

function formatTtl(ttl?: number | null) {
  if (!ttl) return '—'
  return `${ttl}s`
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto" @click.self="handleClose">
      <div class="fixed inset-0 bg-black/50 transition-opacity" @click="handleClose"></div>

      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-lg shadow-xl" @click.stop>
          <div class="flex items-start justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('windowsDns.redirects.dns_conflict.title') }}
              </h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {{ t('windowsDns.redirects.dns_conflict.description', { recordName }) }}
              </p>
            </div>
            <button
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              :disabled="isApplying"
              @click="handleClose"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4">
            <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
              {{ t('windowsDns.redirects.dns_conflict.warning') }}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {{ t('windowsDns.redirects.dns_conflict.before') }}
                </div>
                <div class="p-3">
                  <div v-if="before.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                    —
                  </div>
                  <ul v-else class="space-y-2">
                    <li v-for="r in before" :key="r.id || `${r.name}:${r.type}:${r.content}`" class="rounded-md bg-white dark:bg-gray-800">
                      <div class="font-mono text-xs text-gray-800 dark:text-gray-100 break-all">
                        <span class="font-semibold">{{ r.type }}</span>
                        <span class="mx-2 text-gray-400">·</span>
                        <span>{{ r.name }}</span>
                        <span class="mx-2 text-gray-400">→</span>
                        <span>{{ r.content }}</span>
                      </div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        TTL: {{ formatTtl(r.ttl) }}
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 dark:border-gray-700">
                <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {{ t('windowsDns.redirects.dns_conflict.after') }}
                </div>
                <div class="p-3">
                  <ul class="space-y-2">
                    <li v-for="r in after" :key="`${r.name}:${r.type}:${r.content}`">
                      <div class="font-mono text-xs text-gray-800 dark:text-gray-100 break-all">
                        <span class="font-semibold">{{ r.type }}</span>
                        <span class="mx-2 text-gray-400">·</span>
                        <span>{{ r.name }}</span>
                        <span class="mx-2 text-gray-400">→</span>
                        <span>{{ r.content }}</span>
                      </div>
                      <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        TTL: {{ formatTtl(r.ttl) }}
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input v-model="confirmAck" type="checkbox" class="mt-1 h-4 w-4" :disabled="isApplying" />
              <span>{{ t('windowsDns.redirects.dns_conflict.ack') }}</span>
            </label>
          </div>

          <div class="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="isApplying"
              @click="handleClose"
            >
              {{ t('windowsDns.redirects.dns_conflict.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              :disabled="isApplying || !confirmAck"
              @click="handleConfirm"
            >
              <span v-if="isApplying" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ t('windowsDns.redirects.dns_conflict.applying') }}
              </span>
              <span v-else>
                {{ t('windowsDns.redirects.dns_conflict.continue') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

