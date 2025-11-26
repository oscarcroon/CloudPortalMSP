<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Tenants</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Hantera distributörer och leverantörer. Distributörer kan skapa leverantörer, leverantörer kan skapa organisationer.
      </p>
    </header>

    <div class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
      <form class="flex flex-1 flex-col gap-2 sm:flex-row" @submit.prevent="applySearch">
        <input
          v-model="searchInput"
          type="text"
          class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          placeholder="Sök efter namn eller slug"
        />
        <div class="flex gap-2">
          <button
            type="submit"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          >
            Sök
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="clearSearch"
          >
            Rensa
          </button>
        </div>
      </form>

      <div class="flex gap-2">
        <NuxtLink
          v-if="canCreateDistributor"
          to="/admin/tenants/new?type=distributor"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa distributör
        </NuxtLink>
        <NuxtLink
          v-if="canCreateSupplier"
          to="/admin/tenants/new?type=provider"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa leverantör
        </NuxtLink>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Alla tenants</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ tenants.length }} resultat
            <span v-if="appliedQuery">för "{{ appliedQuery }}"</span>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              v-model="showAllOrganizations"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
            />
            <span class="text-xs">Visa alla organisationer</span>
          </label>
          <button
            class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="refreshList"
          >
            Uppdatera
          </button>
        </div>
      </div>

      <div v-if="listError" class="px-6 py-4 text-sm text-red-500">{{ listError }}</div>
      <div v-else-if="pending" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">Laddar tenants...</div>
      <div v-else-if="!tenants.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
        Inga tenants matchade din sökning.
      </div>
      <div v-else class="overflow-x-auto p-4 sm:p-6">
        <!-- Tree View -->
        <div class="space-y-1 min-w-0 pl-0">
          <TenantTreeNode
            v-for="node in tenantTree"
            :key="node.tenant.id"
            :node="node"
            :level="0"
            :show-all-organizations="showAllOrganizations"
            :organizations="organizations"
            @navigate="navigateToTenant"
            @toggle-orgs="handleToggleOrgs"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import TenantTreeNode from '~/components/admin/TenantTreeNode.vue'
import type { AdminTenantSummary } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const auth = useAuth()
const searchInput = ref('')
const appliedQuery = ref('')

const canCreateDistributor = computed(() => {
  // Super admins or users with admin role and includeChildren can create distributors
  if (auth.isSuperAdmin.value) return true
  for (const [tenantId, role] of Object.entries(auth.state.value.data?.tenantRoles ?? {})) {
    const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenantId] ?? false
    if (role === 'admin' && includeChildren) return true
  }
  return false
})

const canCreateSupplier = computed(() => {
  // Super admins or users with admin role and includeChildren can create providers
  if (auth.isSuperAdmin.value) return true
  for (const [tenantId, role] of Object.entries(auth.state.value.data?.tenantRoles ?? {})) {
    const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenantId] ?? false
    if (role === 'admin' && includeChildren) return true
  }
  return false
})

interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations: Array<{
    id: string
    name: string
    slug: string
    status: string
    tenantId: string | null
    createdAt: number
    memberCount: number
    hasEmailOverride?: boolean
  }>
  distributorProviderLinks?: Array<{
    distributorId: string
    providerId: string
  }>
}

const { data, pending, refresh, error } = await useFetch<TenantsResponse>(
  '/api/admin/tenants',
  {
    query: () => (appliedQuery.value ? { q: appliedQuery.value } : {}),
    watch: [appliedQuery]
  }
)

const tenants = computed(() => data.value?.tenants ?? [])
const organizations = computed(() => data.value?.organizations ?? [])
const distributorProviderLinks = computed(() => data.value?.distributorProviderLinks ?? [])
const listError = computed(() => (error.value ? error.value.message : ''))
const showAllOrganizations = ref(false)

// Build hierarchical tree structure
interface TenantTreeNode {
  tenant: AdminTenantSummary | {
    id: string
    name: string
    slug: string
    type: 'organization'
    parentTenantId?: string | null
    status: string
    createdAt: number
    memberCount: number
    hasEmailOverride?: boolean
  }
  children: TenantTreeNode[]
  isOrganization?: boolean
}

const tenantTree = computed(() => {
  const flatList = tenants.value
  const orgsList = organizations.value
  const nodeMap = new Map<string, TenantTreeNode>()
  const roots: TenantTreeNode[] = []

  // Create nodes for tenants
  for (const tenant of flatList) {
    nodeMap.set(tenant.id, {
      tenant,
      children: []
    })
  }

  // Build tree for tenants using many-to-many relations
  // Distributors are root level, Providers are linked to Distributors via junction table
  // For many-to-many, show each Provider under ALL Distributors it's linked to
  for (const tenant of flatList) {
    const node = nodeMap.get(tenant.id)!
    
    // Check if this tenant is linked via junction table
    let linked = false
    if (tenant.type === 'provider') {
      // Provider: find ALL distributors it's linked to (many-to-many)
      const links = distributorProviderLinks.value.filter(link => link.providerId === tenant.id)
      for (const link of links) {
        if (nodeMap.has(link.distributorId)) {
          const distributor = nodeMap.get(link.distributorId)!
          // Create a copy of the node for each distributor (since a provider can be under multiple distributors)
          distributor.children.push({
            ...node,
            tenant: { ...node.tenant } // Shallow copy to avoid reference issues
          })
          linked = true
        }
      }
    } else if (tenant.type === 'distributor') {
      // Distributor: check if it has any providers linked (will be added as children)
      // Distributors are root level
    }
    
    // Legacy: Also check parentTenantId for backward compatibility
    if (!linked && tenant.parentTenantId && nodeMap.has(tenant.parentTenantId)) {
      const parent = nodeMap.get(tenant.parentTenantId)!
      parent.children.push(node)
      linked = true
    }
    
    // If not linked, it's a root node
    if (!linked) {
      roots.push(node)
    }
  }

  // Organizations are added dynamically in TenantTreeNode component based on toggle state
  // We don't add them to the tree here - they're handled per-distributor in the component

  // Sort: distributors first (root), then providers, then organizations
  const sortNodes = (nodes: TenantTreeNode[]): TenantTreeNode[] => {
    return nodes.sort((a, b) => {
      const typeOrder = { distributor: 0, provider: 1, organization: 2 }
      const orderA = typeOrder[a.tenant.type as keyof typeof typeOrder] ?? 99
      const orderB = typeOrder[b.tenant.type as keyof typeof typeOrder] ?? 99
      if (orderA !== orderB) return orderA - orderB
      return a.tenant.name.localeCompare(b.tenant.name)
    }).map(node => ({
      ...node,
      children: sortNodes(node.children)
    }))
  }

  return sortNodes(roots)
})

const applySearch = () => {
  appliedQuery.value = searchInput.value.trim()
}

const clearSearch = () => {
  searchInput.value = ''
  appliedQuery.value = ''
  refresh()
}

const navigateToTenant = (payload: { type: 'tenant' | 'organization'; id?: string; slug?: string }) => {
  if (payload.type === 'organization' && payload.slug) {
    router.push(`/admin/organizations/${payload.slug}/overview`)
  } else if (payload.type === 'tenant' && payload.id) {
    router.push(`/admin/tenants/${payload.id}`)
  }
}

const refreshList = () => {
  refresh()
}

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })

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

const getParentName = (parentId: string | null | undefined) => {
  if (!parentId) return ''
  const parent = tenants.value.find((t) => t.id === parentId)
  return parent?.name ?? parentId
}

const handleToggleOrgs = (distributorId: string) => {
  // This will be handled by TenantTreeNode component
}
</script>

