<template>
  <div class="relative min-w-0">
    <div
      class="group relative flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-white/5 overflow-hidden"
      :style="{ paddingLeft: level > 0 ? `${level * 24 + 12}px` : '12px' }"
    >
       <!-- Tree connector lines -->
       <div
         v-if="level > 0"
         class="absolute left-0 top-0 bottom-0 pointer-events-none"
         :style="{ width: `${level * 24}px` }"
       >
         <!-- Vertical lines for parent levels (always show to connect the tree) -->
         <template v-for="i in level - 1" :key="`parent-line-${i}`">
           <div
             class="absolute border-l border-slate-300 dark:border-slate-600"
             :style="{
               left: `${i * 24 + 12}px`,
               top: 0,
               bottom: 0,
               width: '1px'
             }"
           />
         </template>
         
         <!-- L-shaped connector for current level -->
         <div
           class="absolute"
           :style="{
             left: `${(level - 1) * 24}px`,
             top: '50%',
             transform: 'translateY(-50%)'
           }"
         >
           <!-- Vertical line (up from center) -->
           <div
             class="absolute left-[12px] w-px border-l border-slate-300 dark:border-slate-600"
             :style="{
               top: hasSiblingAfter ? 'calc(-50% - 6px)' : '-12px',
               height: hasSiblingAfter ? 'calc(50% + 6px)' : '12px'
             }"
           />
           <!-- Horizontal line (from end of vertical line to this node) -->
           <div
             class="absolute left-[12px] top-0 h-px w-3 border-t border-slate-300 dark:border-slate-600"
           />
         </div>
         
         <!-- Vertical line continuation if has siblings after (continues down from connector point) -->
         <div
           v-if="hasSiblingAfter"
           class="absolute border-l border-slate-300 dark:border-slate-600"
           :style="{
             left: `${(level - 1) * 24 + 12}px`,
             top: 'calc(50% + 6px)',
             bottom: 0,
             width: '1px'
           }"
         />
       </div>

      <!-- Tenant content -->
      <div
        class="flex flex-1 cursor-pointer items-center gap-2 sm:gap-3 min-w-0"
        @click="$emit('navigate', node.tenant.id)"
      >
        <!-- Type icon -->
        <div
          class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg"
          :class="getTypeIconClass(node.tenant.type)"
        >
          <Icon :icon="getTypeIcon(node.tenant.type)" class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

        <!-- Tenant info -->
        <div class="min-w-0 flex-1 overflow-hidden">
          <div class="flex items-center gap-1 sm:gap-2 flex-wrap">
            <span class="truncate font-semibold text-sm sm:text-base text-slate-900 dark:text-white">{{ node.tenant.name }}</span>
            <span
              class="shrink-0 inline-flex items-center rounded-full px-1.5 sm:px-2 py-0.5 text-xs font-semibold"
              :class="getTypeClass(node.tenant.type)"
            >
              {{ getTypeLabel(node.tenant.type) }}
            </span>
            <StatusPill :variant="node.tenant.status === 'active' ? 'success' : 'warning'" class="shrink-0 text-xs">
              {{ node.tenant.status }}
            </StatusPill>
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span class="font-mono truncate max-w-[120px] sm:max-w-none">{{ node.tenant.slug }}</span>
            <span class="whitespace-nowrap">{{ node.tenant.memberCount }} medlemmar</span>
            <span v-if="node.tenant.type === 'distributor' && node.tenant.organizationCount !== undefined" class="whitespace-nowrap">
              {{ node.tenant.organizationCount }} organisationer
            </span>
            <span
              v-if="node.tenant.hasEmailOverride"
              class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 sm:px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shrink-0"
              title="E-post override aktiv"
            >
              <Icon icon="mdi:email-check" class="h-3 w-3" />
              <span class="hidden sm:inline">E-post override</span>
              <span class="sm:hidden">E-post</span>
            </span>
            <span class="whitespace-nowrap">{{ formatDate(node.tenant.createdAt) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            class="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
            @click.stop="$emit('navigate', node.tenant.id)"
            title="Visa detaljer"
          >
            <Icon icon="mdi:chevron-right" class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Children -->
    <TenantTreeNode
      v-for="(child, index) in node.children"
      :key="child.tenant.id"
      :node="child"
      :level="level + 1"
      :has-sibling-after="index < node.children.length - 1"
      @navigate="$emit('navigate', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminTenantSummary } from '~/types/admin'

interface TenantTreeNode {
  tenant: AdminTenantSummary
  children: TenantTreeNode[]
}

interface Props {
  node: TenantTreeNode
  level: number
  hasSiblingAfter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasSiblingAfter: false
})

defineEmits<{
  navigate: [id: string]
}>()

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'provider':
      return 'Leverantör'
    case 'distributor':
      return 'Distributör'
    case 'organization':
      return 'Organisation'
    default:
      return type
  }
}

const getTypeClass = (type: string) => {
  switch (type) {
    case 'provider':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'distributor':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'organization':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'provider':
      return 'mdi:office-building'
    case 'distributor':
      return 'mdi:store'
    case 'organization':
      return 'mdi:domain'
    default:
      return 'mdi:folder'
  }
}

const getTypeIconClass = (type: string) => {
  switch (type) {
    case 'provider':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    case 'distributor':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
    case 'organization':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short'
  })
</script>
