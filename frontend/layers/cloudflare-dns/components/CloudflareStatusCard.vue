<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Cloudflare DNS</h2>
      </div>
      <div
        class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <Icon icon="mdi:cloud-outline" class="h-4 w-4 text-brand" />
        <span>{{ summary.zones }} zoner</span>
      </div>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Senaste synk</p>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <span v-if="summary.lastSyncAt">{{ formatDate(summary.lastSyncAt) }}</span>
          <span v-else>Ingen synk ännu</span>
        </p>
        <p
          v-if="summary.lastSyncStatus"
          :class="[
            'text-xs font-medium',
            summary.lastSyncStatus === 'ok'
              ? 'text-green-600'
              : summary.lastSyncStatus === 'error'
                ? 'text-red-600'
                : 'text-slate-500'
          ]"
        >
          Status: {{ summary.lastSyncStatus }}
        </p>
        <p v-if="summary.lastSyncError" class="text-xs text-red-600">
          {{ summary.lastSyncError }}
        </p>
      </div>

      <div class="space-y-1">
        <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Token validerad</p>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <span v-if="summary.lastValidatedAt">{{ formatDate(summary.lastValidatedAt) }}</span>
          <span v-else>Ej verifierad</span>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  summary: {
    zones: number
    lastSyncAt?: string | Date | null
    lastSyncStatus?: string | null
    lastSyncError?: string | null
    lastValidatedAt?: string | Date | null
  }
}>()

const formatDate = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString()
}
</script>


