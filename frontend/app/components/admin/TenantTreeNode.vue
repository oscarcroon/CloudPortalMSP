<template>
  <div class="relative min-w-0">
    <div
      class="group relative flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-white/5 overflow-hidden"
      :style="{ paddingLeft: level > 0 ? `${level * 24 + 12}px` : '12px' }"
    >
       <!-- Tree connector lines -->
       <div
         v-if="level > 0"
         class="absolute left-0 top-0 pointer-events-none"
         :style="{ 
           width: `${level * 24}px`,
           height: '100%'
         }"
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
               top: hasSiblingAfter || (shouldShowChildren && visibleChildren.length > 0) ? 'calc(-50% - 6px)' : '-12px',
               height: hasSiblingAfter || (shouldShowChildren && visibleChildren.length > 0) ? 'calc(50% + 6px)' : '12px'
             }"
           />
           <!-- Horizontal line (from end of vertical line to this node) -->
           <div
             class="absolute left-[12px] top-0 h-px w-3 border-t border-slate-300 dark:border-slate-600"
           />
         </div>
         
         <!-- Vertical line continuation if has siblings after OR has children (continues down from connector point) -->
         <div
           v-if="hasSiblingAfter || (shouldShowChildren && visibleChildren.length > 0)"
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
        class="flex flex-1 items-center gap-2 sm:gap-3 min-w-0"
      >
        <!-- Toggle button for providers (organizations are now under providers) -->
        <button
          v-if="node.tenant.type === 'provider' && hasOrganizations"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
          @click.stop="toggleOrganizations"
          :title="showProviderOrgs ? t('adminTenants.toggleOrgs.hide') : t('adminTenants.toggleOrgs.show')"
        >
          <Icon
            :icon="showProviderOrgs ? 'mdi:chevron-down' : 'mdi:chevron-right'"
            class="h-4 w-4"
          />
        </button>
        <div v-else-if="level > 0" class="w-6 shrink-0" />

        <!-- Type icon -->
        <div
          class="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg"
          :class="getTypeIconClass(node.tenant.type)"
          @click="handleNavigate"
        >
          <Icon :icon="getTypeIcon(node.tenant.type)" class="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

        <!-- Tenant info -->
        <div
          class="min-w-0 flex-1 cursor-pointer overflow-hidden"
          @click="handleNavigate"
        >
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
            <span class="whitespace-nowrap">{{ t('adminTenants.members', { count: node.tenant.memberCount }) }}</span>
            <span v-if="node.tenant.type === 'provider' && node.tenant.organizationCount !== undefined" class="whitespace-nowrap">
              {{ t('adminTenants.organizations', { count: node.tenant.organizationCount }) }}
            </span>
            <span
              v-if="node.tenant.hasEmailOverride"
              class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 sm:px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shrink-0"
              :title="t('adminTenants.emailOverride.active')"
            >
              <Icon icon="mdi:email-check" class="h-3 w-3" />
              <span class="hidden sm:inline">{{ t('adminTenants.emailOverride.label') }}</span>
              <span class="sm:hidden">{{ t('adminTenants.emailOverride.short') }}</span>
            </span>
            <span class="whitespace-nowrap">{{ formatDate(node.tenant.createdAt) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            class="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
            @click.stop="handleNavigate"
            :title="t('adminTenants.viewDetails')"
          >
            <Icon icon="mdi:chevron-right" class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Children (tenants and organizations) -->
    <template v-if="shouldShowChildren">
      <TenantTreeNode
        v-for="(child, index) in visibleChildren"
        :key="`${child.tenant.id}-${child.isOrganization ? 'org' : 'tenant'}`"
        :node="child"
        :level="level + 1"
        :has-sibling-after="index < visibleChildren.length - 1"
        :show-all-organizations="showAllOrganizations"
        :organizations="organizations"
        @navigate="$emit('navigate', $event)"
        @toggle-orgs="$emit('toggleOrgs', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminTenantSummary } from '~/types/admin'
import { useI18n } from '#imports'

const { t } = useI18n()

interface OrganizationNode {
  id: string
  name: string
  slug: string
  status: string
  tenantId: string | null
  createdAt: number
  memberCount: number
  hasEmailOverride?: boolean
}

interface TenantTreeNode {
  tenant: AdminTenantSummary | (OrganizationNode & { type: 'organization' })
  children: TenantTreeNode[]
  isOrganization?: boolean
}

interface Props {
  node: TenantTreeNode
  level: number
  hasSiblingAfter?: boolean
  showAllOrganizations?: boolean
  organizations?: OrganizationNode[]
}

const props = withDefaults(defineProps<Props>(), {
  hasSiblingAfter: false,
  showAllOrganizations: false,
  organizations: () => []
})

const emit = defineEmits<{
  navigate: [payload: { type: 'tenant' | 'organization'; id?: string; slug?: string }]
  toggleOrgs: [distributorId: string]
}>()

// Local state for showing organizations for this specific provider
// If showAllOrganizations is true, we should show them by default
const showProviderOrgs = ref(props.showAllOrganizations)

// Watch for changes in showAllOrganizations prop
watch(() => props.showAllOrganizations, (newValue) => {
  if (props.node.tenant.type === 'provider') {
    showProviderOrgs.value = newValue
  }
})

// Check if this provider has organizations (including filtered ones)
const hasOrganizations = computed(() => {
  if (props.node.tenant.type !== 'provider') return false
  return props.organizations.some(org => org.tenantId === props.node.tenant.id)
})

// Determine which children to show
const visibleChildren = computed(() => {
  if (props.node.tenant.type === 'provider') {
    // For providers, show tenant children + organizations if toggled
    const children = [...props.node.children]
    if (showProviderOrgs.value || props.showAllOrganizations) {
      const orgs = props.organizations
        .filter(org => org.tenantId === props.node.tenant.id)
        .map(org => ({
          tenant: {
            ...org,
            type: 'organization' as const
          },
          children: [],
          isOrganization: true
        }))
      children.push(...orgs)
    }
    return children
  }
  // For other types, show all children
  return props.node.children
})

// Should show children (tenants always, organizations based on toggle)
const shouldShowChildren = computed(() => {
  if (props.node.tenant.type === 'provider') {
    // Show if has tenant children OR if organizations are toggled
    return props.node.children.length > 0 || showProviderOrgs.value || props.showAllOrganizations
  }
  // For other types, show if has children
  return props.node.children.length > 0
})

const toggleOrganizations = () => {
  if (props.node.tenant.type === 'provider') {
    showProviderOrgs.value = !showProviderOrgs.value
    emit('toggleOrgs', props.node.tenant.id)
  }
}

const handleNavigate = () => {
  // Organizations should navigate to organization page, tenants to tenant page
  if (props.node.tenant.type === 'organization' || props.node.isOrganization) {
    emit('navigate', { type: 'organization', slug: props.node.tenant.slug })
  } else {
    emit('navigate', { type: 'tenant', id: props.node.tenant.id })
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'provider':
      return t('adminTenants.badges.provider')
    case 'distributor':
      return t('adminTenants.badges.distributor')
    case 'organization':
      return t('adminTenants.badges.organization')
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
      return 'mdi:store'
    case 'distributor':
      return 'mdi:city'
    case 'organization':
      return 'mdi:home'
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
