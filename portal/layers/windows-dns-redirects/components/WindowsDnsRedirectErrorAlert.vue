<script setup lang="ts">
/**
 * WindowsDnsRedirect Error Alert Component
 * Displays user-friendly error messages with optional retry button
 */
import type { WindowsDnsRedirectErrorType } from '../composables/useWindowsDnsRedirectError'

const props = defineProps<{
  type?: WindowsDnsRedirectErrorType
  title?: string
  message?: string
  showRetry?: boolean
  isRetrying?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'dismiss'): void
}>()

const { t } = useI18n()

// Determine icon and colors based on error type
const errorConfig = computed(() => {
  const type = props.type || 'generic'
  switch (type) {
    case 'network':
      return {
        icon: 'wifi-off',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        iconBgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        titleColor: 'text-yellow-800 dark:text-yellow-200',
        messageColor: 'text-yellow-700 dark:text-yellow-300',
      }
    case 'server':
      return {
        icon: 'server',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        iconBgColor: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400',
        titleColor: 'text-red-800 dark:text-red-200',
        messageColor: 'text-red-700 dark:text-red-300',
      }
    default:
      return {
        icon: 'alert',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        iconBgColor: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400',
        titleColor: 'text-red-800 dark:text-red-200',
        messageColor: 'text-red-700 dark:text-red-300',
      }
  }
})

// Get default texts from i18n if not provided
const displayTitle = computed(() => {
  if (props.title) return props.title
  const type = props.type || 'generic'
  return t(`windowsDns.redirects.errors.${type}.title`)
})

const displayMessage = computed(() => {
  if (props.message) return props.message
  const type = props.type || 'generic'
  return t(`windowsDns.redirects.errors.${type}.message`)
})

const retryText = computed(() => {
  const type = props.type || 'generic'
  return t(`windowsDns.redirects.errors.${type}.retry`)
})
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-4',
      errorConfig.bgColor,
      errorConfig.borderColor,
    ]"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <div
        :class="[
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          errorConfig.iconBgColor,
        ]"
      >
        <!-- Network/Wifi Off Icon -->
        <svg
          v-if="errorConfig.icon === 'wifi-off'"
          :class="['w-5 h-5', errorConfig.iconColor]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072-7.072m7.072 7.072L9.879 9.879m-7.072 7.072L3 21m4.243-4.243a5 5 0 017.072-7.072"
          />
        </svg>
        <!-- Server Icon -->
        <svg
          v-else-if="errorConfig.icon === 'server'"
          :class="['w-5 h-5', errorConfig.iconColor]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
        <!-- Default Alert Icon -->
        <svg
          v-else
          :class="['w-5 h-5', errorConfig.iconColor]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <h3 :class="['text-sm font-semibold', errorConfig.titleColor]">
          {{ displayTitle }}
        </h3>
        <p :class="['mt-1 text-sm', errorConfig.messageColor]">
          {{ displayMessage }}
        </p>

        <!-- Actions -->
        <div v-if="showRetry" class="mt-3 flex items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isRetrying"
            @click="emit('retry')"
          >
            <svg
              v-if="isRetrying"
              class="animate-spin -ml-0.5 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <svg
              v-else
              class="-ml-0.5 mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {{ retryText }}
          </button>
        </div>
      </div>

      <!-- Dismiss button -->
      <button
        type="button"
        class="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none"
        @click="emit('dismiss')"
      >
        <svg
          class="w-4 h-4 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
