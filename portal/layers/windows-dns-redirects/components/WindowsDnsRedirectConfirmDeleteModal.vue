<script setup lang="ts">
/**
 * WindowsDnsRedirect Confirm Delete Modal
 * Shows confirmation before deleting redirects
 */
const props = defineProps<{
  isOpen: boolean
  title?: string
  message?: string
  isDeleting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()

const title = computed(() => props.title || t('windowsDns.redirects.confirm.delete_title'))
const message = computed(() => props.message || t('windowsDns.redirects.confirm.delete_message'))

function handleClose() {
  if (!props.isDeleting) {
    emit('close')
  }
}
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
          class="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-xl"
          @click.stop
        >
          <!-- Body -->
          <div class="p-6 text-center">
            <!-- Warning Icon -->
            <div class="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {{ title }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {{ message }}
            </p>

            <!-- Actions -->
            <div class="flex items-center justify-center gap-3">
              <button
                type="button"
                class="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                :disabled="isDeleting"
                @click="handleClose"
              >
                {{ t('windowsDns.redirects.confirm.cancel') }}
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                :disabled="isDeleting"
                @click="emit('confirm')"
              >
                <span v-if="isDeleting" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {{ t('windowsDns.redirects.confirm.deleting') }}
                </span>
                <span v-else>{{ t('windowsDns.redirects.confirm.confirm') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
