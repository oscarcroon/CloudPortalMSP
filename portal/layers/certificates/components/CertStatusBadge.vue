<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="statusClasses"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="dotClasses" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: string
}>()

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Active'
  },
  expiring: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'Expiring'
  },
  expired: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Expired'
  },
  pending: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    label: 'Pending'
  },
  queued: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    label: 'Queued'
  },
  processing: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-400',
    dot: 'bg-indigo-500 animate-pulse',
    label: 'Processing'
  },
  completed: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Completed'
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Failed'
  },
  cancelled: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    label: 'Cancelled'
  },
  running: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-400',
    dot: 'bg-indigo-500 animate-pulse',
    label: 'Running'
  },
  revoked: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Revoked'
  },
  replaced: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    label: 'Replaced'
  },
  inactive: {
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    label: 'Inactive'
  }
}

const config = computed(() => statusConfig[props.status] ?? {
  bg: 'bg-slate-50 dark:bg-slate-800',
  text: 'text-slate-600 dark:text-slate-400',
  dot: 'bg-slate-400',
  label: props.status
})

const statusClasses = computed(() => `${config.value.bg} ${config.value.text}`)
const dotClasses = computed(() => config.value.dot)
const label = computed(() => config.value.label)
</script>
