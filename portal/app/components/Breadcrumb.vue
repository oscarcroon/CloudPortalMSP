<template>
  <nav class="flex items-center gap-2 text-sm overflow-hidden" aria-label="Breadcrumb">
    <ol class="flex items-center gap-2 min-w-0 flex-1">
      <!-- First item - always visible -->
      <li
        v-if="firstItem"
        class="flex items-center gap-2 flex-shrink-0"
      >
        <NuxtLink
          v-if="firstItem.to"
          :to="firstItem.to"
          :class="[
            'inline-flex items-center gap-1.5 transition-colors text-slate-600 hover:text-brand dark:text-slate-300 dark:hover:text-brand cursor-pointer min-w-0',
            items.length === 1 && 'font-semibold'
          ]"
          :aria-current="items.length === 1 ? 'page' : undefined"
        >
          <Icon v-if="firstItem.icon" :icon="firstItem.icon" class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">{{ firstItem.label }}</span>
        </NuxtLink>
        <span
          v-else
          :class="[
            'inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-50 font-medium min-w-0',
            items.length === 1 && 'font-semibold'
          ]"
          :aria-current="items.length === 1 ? 'page' : undefined"
        >
          <Icon v-if="firstItem.icon" :icon="firstItem.icon" class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">{{ firstItem.label }}</span>
        </span>
      </li>

      <!-- Middle items - hidden on mobile, visible on desktop -->
      <template v-for="(item, index) in middleItems" :key="`middle-${index}`">
        <li class="hidden md:flex items-center gap-2 flex-shrink-0">
          <Icon icon="mdi:chevron-right" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <NuxtLink
            v-if="item.to"
            :to="item.to"
            class="inline-flex items-center gap-1.5 transition-colors text-slate-600 hover:text-brand dark:text-slate-300 dark:hover:text-brand cursor-pointer min-w-0"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4 flex-shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </NuxtLink>
          <span
            v-else
            class="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-50 font-medium min-w-0"
          >
            <Icon v-if="item.icon" :icon="item.icon" class="h-4 w-4 flex-shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </span>
        </li>
      </template>

      <!-- Ellipsis - shown on mobile when there are middle items, clickable to go back one step -->
      <li
        v-if="middleItems.length > 0"
        class="flex items-center gap-2 flex-shrink-0 md:hidden"
      >
        <Icon icon="mdi:chevron-right" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <button
          v-if="previousItem"
          @click="navigateToPrevious"
          class="text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-brand transition-colors cursor-pointer"
          :title="`Go back to ${previousItem.label}`"
        >
          ...
        </button>
        <span v-else class="text-slate-500 dark:text-slate-400">...</span>
      </li>

      <!-- Last item - always visible -->
      <li
        v-if="lastItem"
        class="flex items-center gap-2 flex-shrink-0 min-w-0"
      >
        <Icon icon="mdi:chevron-right" class="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <NuxtLink
          v-if="lastItem.to"
          :to="lastItem.to"
          :class="[
            'inline-flex items-center gap-1.5 transition-colors text-slate-600 hover:text-brand dark:text-slate-300 dark:hover:text-brand cursor-pointer min-w-0',
            'font-semibold'
          ]"
          aria-current="page"
        >
          <Icon v-if="lastItem.icon" :icon="lastItem.icon" class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">{{ lastItem.label }}</span>
        </NuxtLink>
        <span
          v-else
          class="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-50 font-medium min-w-0 font-semibold"
          aria-current="page"
        >
          <Icon v-if="lastItem.icon" :icon="lastItem.icon" class="h-4 w-4 flex-shrink-0" />
          <span class="truncate">{{ lastItem.label }}</span>
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

export interface BreadcrumbItem {
  label: string
  icon?: string
  to?: string
}

const props = defineProps<{
  items: BreadcrumbItem[]
}>()

const router = useRouter()

// Computed first/last items to avoid array-index-undefined TS errors
const firstItem = computed(() => props.items[0] as BreadcrumbItem | undefined)
const lastItem = computed(() => props.items.length > 1 ? props.items[props.items.length - 1] as BreadcrumbItem | undefined : undefined)

// Middle items are all items except first and last
const middleItems = computed(() => {
  if (props.items.length <= 2) return []
  return props.items.slice(1, -1)
})

// Previous item is the one before the last (second to last)
const previousItem = computed(() => {
  if (props.items.length < 2) return null
  return props.items[props.items.length - 2]
})

// Navigate to previous breadcrumb item
const navigateToPrevious = () => {
  if (previousItem.value?.to) {
    router.push(previousItem.value.to)
  } else {
    // Fallback to browser back if no route is available
    router.back()
  }
}
</script>
