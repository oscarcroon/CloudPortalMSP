<template>
  <div class="mod-certificates-panel flex items-center gap-4">
    <div
      class="flex h-10 w-10 items-center justify-center rounded-lg"
      :class="colorClasses"
    >
      <Icon :icon="icon" class="h-5 w-5" />
    </div>
    <div>
      <p class="text-2xl font-bold text-slate-900 dark:text-slate-50">{{ value }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ label }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  label: string
  value: string | number
  icon: string
  color: 'emerald' | 'amber' | 'blue' | 'purple' | 'red'
}>()

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
}

const colorClasses = computed(() => colorMap[props.color] ?? colorMap.blue)
</script>
