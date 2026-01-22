<template>
  <nav class="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center gap-2"
      >
        <template v-if="index > 0">
          <Icon icon="mdi:chevron-right" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
        </template>
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          :class="[
            'inline-flex items-center gap-1.5 transition-colors text-slate-600 hover:text-brand dark:text-slate-300 dark:hover:text-brand cursor-pointer',
            index === items.length - 1 && 'font-semibold'
          ]"
          :aria-current="index === items.length - 1 ? 'page' : undefined"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </NuxtLink>
        <span
          v-else
          :class="[
            'inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-50 font-medium',
            index === items.length - 1 && 'font-semibold'
          ]"
          :aria-current="index === items.length - 1 ? 'page' : undefined"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface BreadcrumbItem {
  label: string
  icon?: string
  to?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>

