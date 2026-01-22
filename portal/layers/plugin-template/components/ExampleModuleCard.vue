<template>
  <article
    class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-card transition hover:-translate-y-[1px] hover:shadow-xl dark:border-slate-700 dark:bg-slate-900"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon :icon="icon" class="h-5 w-5" />
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ badge }}</p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ title }}</h3>
        </div>
      </div>
      <slot name="action">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
        >
          <Icon icon="mdi:open-in-new" class="h-4 w-4" />
          Open
        </button>
      </slot>
    </div>
    <p class="text-sm text-slate-600 dark:text-slate-300">
      <slot />
    </p>
    <div class="flex flex-wrap gap-2">
      <span v-for="tag in tags" :key="tag" class="mod-example-module-tag">
        <Icon icon="mdi:checkbox-marked-circle-outline" class="h-4 w-4 text-brand" />
        {{ tag }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  title: string
  badge?: string
  icon?: string
  tags?: string[]
}>()
</script>


