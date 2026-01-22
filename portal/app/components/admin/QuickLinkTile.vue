<template>
  <component
    :is="disabled ? 'div' : NuxtLink"
    :to="disabled ? undefined : to"
    class="group flex flex-col gap-2 rounded-xl border p-4 transition"
    :class="tileClasses"
  >
    <div class="flex items-center gap-2">
      <Icon :icon="icon" class="h-5 w-5" :class="iconClasses" />
      <span class="font-medium" :class="labelClasses">{{ label }}</span>
      <span
        v-if="disabled"
        class="ml-auto rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-white/10 dark:text-slate-400"
      >
        Coming soon
      </span>
    </div>
    <p class="text-sm" :class="descriptionClasses">{{ description }}</p>
  </component>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { Icon } from '@iconify/vue'

const NuxtLink = resolveComponent('NuxtLink')

const props = defineProps<{
  to: string
  icon: string
  label: string
  description: string
  disabled?: boolean
}>()

const tileClasses = computed(() => {
  if (props.disabled) {
    return 'cursor-not-allowed border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/5'
  }
  return 'cursor-pointer border-slate-200 bg-white hover:border-brand hover:bg-brand/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand dark:hover:bg-brand/10'
})

const iconClasses = computed(() => {
  if (props.disabled) {
    return 'text-slate-300 dark:text-slate-600'
  }
  return 'text-brand group-hover:text-brand-dark'
})

const labelClasses = computed(() => {
  if (props.disabled) {
    return 'text-slate-400 dark:text-slate-500'
  }
  return 'text-slate-900 dark:text-slate-100'
})

const descriptionClasses = computed(() => {
  if (props.disabled) {
    return 'text-slate-300 dark:text-slate-600'
  }
  return 'text-slate-500 dark:text-slate-400'
})
</script>

