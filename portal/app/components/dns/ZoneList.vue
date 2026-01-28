<template>
  <div class="space-y-2">
    <button
      v-for="zone in zones"
      :key="zone.id"
      class="w-full rounded-xl border px-4 py-3 text-left transition hover:border-brand hover:text-brand"
      :class="
        zone.id === selectedZoneId
          ? 'border-brand bg-brand-light/30 text-brand-dark dark:border-brand/70 dark:bg-brand/20 dark:text-brand-light'
          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
      "
      @click="$emit('select', zone.id)"
    >
      <p class="text-sm font-semibold">{{ zone.name }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ zone.status }}</p>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { DnsZone } from '~/types/dns'

defineProps<{
  zones: DnsZone[]
  selectedZoneId?: string | null
}>()

defineEmits<{
  select: [id: string]
}>()
</script>

