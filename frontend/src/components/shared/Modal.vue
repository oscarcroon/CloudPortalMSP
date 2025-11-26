<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          <slot name="title" />
        </h3>
        <button
          class="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" class="h-5 w-5" />
        </button>
      </div>
      <div class="text-slate-600 dark:text-slate-400">
        <slot name="content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  show: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

