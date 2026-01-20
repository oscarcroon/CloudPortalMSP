<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg"
          :class="connected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800'"
        >
          <Icon
            icon="mdi:server-network"
            class="h-5 w-5"
            :class="connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'"
          />
        </div>
        <div>
          <p class="font-medium text-slate-900 dark:text-slate-50">{{ $t('windowsDns.statusCard.title') }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ connected ? $t('windowsDns.statusCard.connected') : $t('windowsDns.statusCard.notConfigured') }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="inline-flex h-2 w-2 rounded-full"
          :class="connected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
        />
        <span class="text-xs text-slate-500 dark:text-slate-400">
          {{ connected ? $t('windowsDns.statusCard.online') : $t('windowsDns.statusCard.offline') }}
        </span>
      </div>
    </div>

    <div v-if="stats" class="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div>
        <p class="text-2xl font-semibold text-slate-900 dark:text-slate-50">{{ stats.zones }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t('windowsDns.statusCard.zones') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-slate-900 dark:text-slate-50">{{ stats.owned }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t('windowsDns.statusCard.owned') }}</p>
      </div>
      <div>
        <p class="text-2xl font-semibold text-slate-900 dark:text-slate-50">{{ stats.records }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t('windowsDns.statusCard.records') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  connected: boolean
  stats?: {
    zones: number
    owned: number
    records: number
  }
}>()
</script>

