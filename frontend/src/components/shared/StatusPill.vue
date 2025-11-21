<template>
  <span
    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
    :class="variantClasses[variant]"
  >
    <span v-if="dot" class="mr-2 inline-block h-2 w-2 rounded-full bg-current" />
    <slot />
  </span>
</template>

<script setup lang="ts">
type Variant = 'success' | 'warning' | 'danger' | 'info'

withDefaults(
  defineProps<{
    variant?: Variant
    dot?: boolean
  }>(),
  {
    variant: 'info',
    dot: false
  }
)

const variantClasses: Record<Variant, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100'
}
</script>

