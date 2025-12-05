<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('title') }}</h1>
      <p class="text-gray-500 dark:text-gray-400">{{ t('description') }}</p>
    </div>
    <div class="flex items-center gap-3">
      <button
        class="rounded-md bg-primary-600 px-4 py-2 text-white shadow hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        type="button"
      >
        {{ t('cta') }}
      </button>
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('empty') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>

