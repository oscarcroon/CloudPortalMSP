<script setup lang="ts">
/**
 * WindowsDnsRedirect List Page
 * Shows and manages redirects for a specific zone
 */
import type { WindowsDnsRedirect, WindowsDnsRedirectFilters, WindowsDnsRedirectSortOptions } from '../../../../types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useWindowsDnsRedirectToast()

// Cache entity names for breadcrumbs
const entityNames = useEntityNames()

// Format date for display
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('sv-SE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Module rights from API response (populated by fetchRedirects)
const moduleRights = ref<{
  canView?: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canImport?: boolean
  canExport?: boolean
  canViewConfig?: boolean
  canEditConfig?: boolean
  canViewTraefik?: boolean
  canSyncTraefik?: boolean
}>({})

// RBAC permissions - using moduleRights from API response
const canCreate = computed(() => moduleRights.value.canCreate ?? false)
const canEdit = computed(() => moduleRights.value.canEdit ?? false)
const canDelete = computed(() => moduleRights.value.canDelete ?? false)
const canImport = computed(() => moduleRights.value.canImport ?? false)
const canExport = computed(() => moduleRights.value.canExport ?? false)

const zoneId = computed(() => route.params.zoneId as string)

// Zone info
const zoneName = ref('')
const zoneExists = ref(true)
const isLoading = ref(true)
const redirects = ref<WindowsDnsRedirect[]>([])
const totalCount = ref(0)

// Page title
useHead({
  title: computed(() => t('windowsDns.redirects.list.title', { zoneName: zoneName.value || zoneId.value })),
})

// Pagination
const currentPage = ref(1)
const pageSize = ref(50)

// Filters
const filters = ref<WindowsDnsRedirectFilters>({
  search: '',
  type: undefined,
  statusCode: undefined,
  isActive: undefined,
})

// Sort
const sort = ref<WindowsDnsRedirectSortOptions>({
  field: 'createdAt',
  direction: 'desc',
})

// Selected redirects for bulk operations
const selectedIds = ref<Set<string>>(new Set())
const isAllSelected = computed(() => {
  return redirects.value.length > 0 && selectedIds.value.size === redirects.value.length
})

// Modal states
const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const showBulkDeleteModal = ref(false)
const showImportModal = ref(false)
const showExportModal = ref(false)
const editingRedirect = ref<WindowsDnsRedirect | null>(null)
const deletingRedirectId = ref<string | null>(null)
const isDeleting = ref(false)
const isBulkDeleting = ref(false)
const isBulkToggling = ref(false)

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

// Get the redirect being deleted
const deletingRedirect = computed(() => {
  if (!deletingRedirectId.value) return null
  return redirects.value.find(r => r.id === deletingRedirectId.value) || null
})

// Get custom delete message
const deleteMessage = computed(() => {
  if (!deletingRedirect.value) return t('windowsDns.redirects.confirm.delete_message')
  return t('windowsDns.redirects.confirm.delete_message_with_source', { source: deletingRedirect.value.sourcePath })
})

// Methods
function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value.clear()
  } else {
    redirects.value.forEach((r) => selectedIds.value.add(r.id))
  }
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function clearFilters() {
  filters.value = {
    search: '',
    type: undefined,
    statusCode: undefined,
    isActive: undefined,
  }
  currentPage.value = 1
}

function handleSort(field: 'createdAt' | 'updatedAt' | 'hitCount' | 'lastHitAt' | 'sourcePath') {
  if (sort.value.field === field) {
    sort.value.direction = sort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.field = field
    sort.value.direction = 'desc'
  }
}

function openCreateModal() {
  editingRedirect.value = null
  showCreateModal.value = true
}

function openEditModal(redirect: WindowsDnsRedirect) {
  editingRedirect.value = redirect
  showCreateModal.value = true
}

function openDeleteModal(id: string) {
  deletingRedirectId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingRedirectId.value) return
  if (isDeleting.value) return

  const redirectToDelete = deletingRedirect.value

  isDeleting.value = true
  try {
    await $fetch(`/api/dns/windows/zones/${zoneId.value}/redirects/${deletingRedirectId.value}`, {
      method: 'DELETE',
    })
    showDeleteModal.value = false
    deletingRedirectId.value = null
    toast.success(t('windowsDns.redirects.toast.deleted', { source: redirectToDelete?.sourcePath || '' }))
    await fetchRedirects()
  } catch (error) {
    console.error('Failed to delete redirect:', error)
    toast.error(t('windowsDns.redirects.toast.delete_failed'))
  } finally {
    isDeleting.value = false
  }
}

function handleBulkDelete() {
  showBulkDeleteModal.value = true
}

async function confirmBulkDelete() {
  if (selectedIds.value.size === 0) return
  if (isBulkDeleting.value) return

  isBulkDeleting.value = true
  try {
    await $fetch(`/api/dns/windows/zones/${zoneId.value}/redirects/bulk-delete`, {
      method: 'POST',
      body: { ids: Array.from(selectedIds.value) },
    })
    showBulkDeleteModal.value = false
    selectedIds.value.clear()
    await fetchRedirects()
  } catch (error) {
    console.error('Failed to bulk delete redirects:', error)
  } finally {
    isBulkDeleting.value = false
  }
}

async function handleBulkToggle(isActive: boolean) {
  if (selectedIds.value.size === 0) return

  isBulkToggling.value = true
  try {
    await $fetch(`/api/dns/windows/zones/${zoneId.value}/redirects/bulk-toggle`, {
      method: 'POST',
      body: { ids: Array.from(selectedIds.value), isActive },
    })
    await fetchRedirects()
  } catch (error) {
    console.error('Failed to bulk toggle redirects:', error)
  } finally {
    isBulkToggling.value = false
  }
}

async function handleToggle(redirect: WindowsDnsRedirect) {
  try {
    await $fetch(`/api/dns/windows/zones/${zoneId.value}/redirects/${redirect.id}`, {
      method: 'PATCH',
      body: { isActive: !redirect.isActive },
    })
    await fetchRedirects()
  } catch (error) {
    console.error('Failed to toggle redirect:', error)
  }
}

function handleSaved(redirect: WindowsDnsRedirect) {
  const isNew = !editingRedirect.value
  if (isNew) {
    toast.success(t('windowsDns.redirects.toast.created', { source: redirect.sourcePath }))
  } else {
    toast.success(t('windowsDns.redirects.toast.updated', { source: redirect.sourcePath }))
  }
  fetchRedirects()
}

// Fetch zone info
async function fetchZoneInfo() {
  try {
    const response = await $fetch<{ zones: Array<{ id: string; name: string }> }>('/api/dns/windows/redirects/zones')
    const zone = response.zones?.find(z => z.id === zoneId.value)
    if (zone) {
      zoneName.value = zone.name
      zoneExists.value = true
      // Cache zone name for breadcrumbs
      if (zone.name) {
        entityNames.setName('zone', zone.id, zone.name)
      }
    } else {
      zoneExists.value = false
    }
  } catch (error) {
    console.error('Failed to load zone info:', error)
    zoneExists.value = false
  }
}

// Fetch redirects
async function fetchRedirects() {
  isLoading.value = true
  try {
    const response = await $fetch(`/api/dns/windows/zones/${zoneId.value}/redirects`, {
      query: {
        page: currentPage.value,
        pageSize: pageSize.value,
        search: filters.value.search || undefined,
        type: filters.value.type,
        statusCode: filters.value.statusCode,
        isActive: filters.value.isActive,
        sortField: sort.value.field,
        sortDirection: sort.value.direction,
      },
    })
    redirects.value = response.items || []
    totalCount.value = response.total || 0

    // Update module rights from API response
    if (response.moduleRights) {
      moduleRights.value = response.moduleRights
    }

    if (redirects.value.length > 0 && !zoneName.value) {
      zoneName.value = redirects.value[0].zoneName || ''
    }
  } catch (error) {
    console.error('Failed to load redirects:', error)
    redirects.value = []
    totalCount.value = 0
  } finally {
    isLoading.value = false
  }
}

// Watch for filter changes
watch(filters, () => {
  currentPage.value = 1
  fetchRedirects()
}, { deep: true })

// Watch for page/sort changes
watch([currentPage, sort], () => {
  fetchRedirects()
}, { deep: true })

// Fetch on mount
onMounted(() => {
  fetchZoneInfo()
  fetchRedirects()
})
</script>

<template>
  <div class="p-4 sm:p-6 overflow-hidden">
    <!-- Zone Not Found -->
    <div v-if="!zoneExists && !isLoading" class="text-center py-12">
      <div class="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-red-100 dark:bg-red-900">
        <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">{{ t('windowsDns.redirects.zone_not_found.title') }}</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-4">{{ t('windowsDns.redirects.zone_not_found.description', { zoneId }) }}</p>
      <NuxtLink
        to="/dns/redirects"
        class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        {{ t('windowsDns.redirects.zone_not_found.back') }}
      </NuxtLink>
    </div>

    <!-- Statistics Panel -->
    <WindowsDnsRedirectStatsPanel v-if="zoneExists" :zone-id="zoneId" />

    <!-- Page Header -->
    <div v-if="zoneExists" class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('windowsDns.redirects.list.title', { zoneName: zoneName || zoneId }) }}
        </h1>
        <NuxtLink
          :to="`/dns/${zoneId}`"
          class="inline-flex items-center gap-2 mt-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {{ t('windowsDns.redirects.actions.open_dns_manager') }}
        </NuxtLink>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-if="canImport"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
          @click="showImportModal = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {{ t('windowsDns.redirects.actions.import') }}
        </button>
        <button
          v-if="canExport"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
          @click="showExportModal = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {{ t('windowsDns.redirects.actions.export') }}
        </button>
        <button
          v-if="canCreate"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-brand text-white rounded-lg shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
          @click="openCreateModal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('windowsDns.redirects.actions.create') }}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="zoneExists" class="mb-6 flex flex-wrap items-center gap-3">
      <input
        v-model="filters.search"
        type="text"
        :placeholder="t('windowsDns.redirects.filters.search')"
        class="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
      />

      <select
        v-model="filters.type"
        class="flex-1 sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
      >
        <option :value="undefined">{{ t('windowsDns.redirects.filters.all_types') }}</option>
        <option value="simple">{{ t('windowsDns.redirects.types.simple') }}</option>
        <option value="wildcard">{{ t('windowsDns.redirects.types.wildcard') }}</option>
        <option value="regex">{{ t('windowsDns.redirects.types.regex') }}</option>
      </select>

      <select
        v-model="filters.statusCode"
        class="w-full sm:w-auto px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
      >
        <option :value="undefined">{{ t('windowsDns.redirects.filters.all_status_codes') }}</option>
        <option :value="301">{{ t('windowsDns.redirects.status_codes.301') }}</option>
        <option :value="302">{{ t('windowsDns.redirects.status_codes.302') }}</option>
        <option :value="307">{{ t('windowsDns.redirects.status_codes.307') }}</option>
        <option :value="308">{{ t('windowsDns.redirects.status_codes.308') }}</option>
      </select>

      <select
        v-model="filters.isActive"
        class="flex-1 sm:flex-none px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
      >
        <option :value="undefined">{{ t('windowsDns.redirects.filters.all_statuses') }}</option>
        <option :value="true">{{ t('windowsDns.redirects.filters.active') }}</option>
        <option :value="false">{{ t('windowsDns.redirects.filters.inactive') }}</option>
      </select>

      <button
        class="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition"
        @click="clearFilters"
      >
        {{ t('windowsDns.redirects.filters.clear') }}
      </button>
    </div>

    <!-- Bulk Actions -->
    <div
      v-if="selectedIds.size > 0 && (canDelete || canEdit)"
      class="mb-4 flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
    >
      <span class="text-sm text-blue-700 dark:text-blue-300">
        {{ selectedIds.size }} {{ t('windowsDns.redirects.bulk.selected') }}
      </span>
      <button
        v-if="canEdit"
        class="px-3 py-1 text-sm text-green-600 hover:text-green-700 dark:text-green-400 disabled:opacity-50"
        :disabled="isBulkToggling"
        @click="handleBulkToggle(true)"
      >
        {{ t('windowsDns.redirects.actions.bulk_activate') }}
      </button>
      <button
        v-if="canEdit"
        class="px-3 py-1 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 disabled:opacity-50"
        :disabled="isBulkToggling"
        @click="handleBulkToggle(false)"
      >
        {{ t('windowsDns.redirects.actions.bulk_deactivate') }}
      </button>
      <button
        v-if="canDelete"
        class="px-3 py-1 text-sm text-red-600 hover:text-red-700"
        @click="handleBulkDelete"
      >
        {{ t('windowsDns.redirects.actions.bulk_delete') }}
      </button>
      <button
        class="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400"
        @click="selectedIds.clear()"
      >
        {{ t('windowsDns.redirects.actions.clear_selection') }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="zoneExists && isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="zoneExists && redirects.length === 0"
      class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <p class="text-gray-500 dark:text-gray-400 mb-4">
        {{ t('windowsDns.redirects.list.empty') }}
      </p>
      <p class="text-gray-400 dark:text-gray-500 text-sm mb-4">
        {{ t('windowsDns.redirects.list.empty_description') }}
      </p>
      <button
        v-if="canCreate"
        class="px-3 py-2 text-sm font-semibold bg-brand text-white rounded-lg shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
        @click="openCreateModal"
      >
        {{ t('windowsDns.redirects.list.create_first') }}
      </button>
    </div>

    <!-- Redirects Table -->
    <div v-else-if="zoneExists" class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <div class="overflow-x-auto">
        <table class="w-full table-auto divide-y divide-slate-100 dark:divide-slate-800">
          <thead class="bg-slate-50 dark:bg-slate-800/40">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <th v-if="canDelete" class="px-2 py-2 w-12">
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="rounded border-gray-300 dark:border-gray-600"
              />
            </th>
            <th class="px-3 py-2 w-32">{{ t('windowsDns.redirects.list.columns.host') }}</th>
            <th class="px-3 py-2 w-32">{{ t('windowsDns.redirects.list.columns.source') }}</th>
            <th class="px-3 py-2 min-w-[200px]">{{ t('windowsDns.redirects.list.columns.destination') }}</th>
            <th class="px-3 py-2 w-24">{{ t('windowsDns.redirects.list.columns.type') }}</th>
            <th class="px-3 py-2 w-20 text-center">{{ t('windowsDns.redirects.list.columns.status_code') }}</th>
            <th class="px-3 py-2 w-20 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" @click="handleSort('hitCount')">
              <div class="flex items-center justify-center gap-1">
                {{ t('windowsDns.redirects.list.columns.hits') }}
                <svg v-if="sort.field === 'hitCount'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="sort.direction === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </th>
            <th class="px-3 py-2 w-16 text-center">{{ t('windowsDns.redirects.list.columns.active') }}</th>
            <th class="px-3 py-2 w-28 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" @click="handleSort('createdAt')">
              <div class="flex items-center gap-1">
                {{ t('windowsDns.redirects.list.columns.created') }}
                <svg v-if="sort.field === 'createdAt'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="sort.direction === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </th>
            <th class="px-3 py-2 w-32">{{ t('windowsDns.redirects.list.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          <tr
            v-for="redirect in redirects"
            :key="redirect.id"
            class="text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <td v-if="canDelete" class="px-2 py-3">
              <input
                type="checkbox"
                :checked="selectedIds.has(redirect.id)"
                @change="toggleSelect(redirect.id)"
                class="rounded border-gray-300 dark:border-gray-600"
              />
            </td>
            <td class="px-3 py-3 align-top font-mono text-xs max-w-[128px] truncate" :title="redirect.host || zoneName">
              <span class="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium dark:bg-slate-800">
                {{ redirect.host || zoneName }}
              </span>
            </td>
            <td class="px-3 py-3 align-top font-mono text-xs max-w-[128px] truncate" :title="redirect.sourcePath">
              {{ redirect.sourcePath }}
            </td>
            <td class="px-3 py-3 align-top font-mono text-xs truncate" :title="redirect.destinationUrl">
              {{ redirect.destinationUrl }}
            </td>
            <td class="px-3 py-3 align-top">
              <span
                :class="[
                  'px-1.5 py-0.5 text-xs rounded-full whitespace-nowrap',
                  redirect.redirectType === 'simple' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  redirect.redirectType === 'wildcard' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                ]"
              >
                {{ t(`windowsDns.redirects.types.${redirect.redirectType}`) }}
              </span>
            </td>
            <td class="px-3 py-3 align-top text-center">
              {{ redirect.statusCode }}
            </td>
            <td class="px-3 py-3 align-top text-center">
              {{ redirect.hitCount }}
            </td>
            <td class="px-3 py-3 align-top text-center">
              <span
                :class="[
                  'inline-block w-2 h-2 rounded-full',
                  redirect.isActive ? 'bg-green-500' : 'bg-gray-400'
                ]"
              ></span>
            </td>
            <td class="px-3 py-3 align-top text-xs whitespace-nowrap">
              {{ formatDate(redirect.createdAt) }}
            </td>
            <td class="px-3 py-3 align-top">
              <div class="flex items-center gap-0.5">
                <button
                  v-if="canEdit"
                  class="p-1.5 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                  :title="t('windowsDns.redirects.actions.edit')"
                  @click.stop="openEditModal(redirect)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  v-if="canEdit"
                  class="p-1.5 flex items-center justify-center text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition"
                  :title="redirect.isActive ? t('windowsDns.redirects.actions.deactivate') : t('windowsDns.redirects.actions.activate')"
                  @click.stop="handleToggle(redirect)"
                >
                  <svg v-if="redirect.isActive" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
                <button
                  v-if="canDelete"
                  class="p-1.5 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  :title="t('windowsDns.redirects.actions.delete')"
                  @click.stop="openDeleteModal(redirect.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <span v-if="!canEdit && !canDelete" class="text-gray-400">—</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('windowsDns.redirects.pagination.showing', { from: (currentPage - 1) * pageSize + 1, to: Math.min(currentPage * pageSize, totalCount), total: totalCount }) }}
      </p>
      <div class="flex items-center space-x-2">
        <button
          :disabled="currentPage === 1"
          class="px-3 py-2 min-h-[44px] text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="currentPage--"
        >
          {{ t('windowsDns.redirects.pagination.previous') }}
        </button>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('windowsDns.redirects.pagination.page', { current: currentPage, total: totalPages }) }}
        </span>
        <button
          :disabled="currentPage === totalPages"
          class="px-3 py-2 min-h-[44px] text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="currentPage++"
        >
          {{ t('windowsDns.redirects.pagination.next') }}
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <WindowsDnsRedirectFormModal
      :is-open="showCreateModal"
      :redirect="editingRedirect"
      :zone-id="zoneId"
      :zone-name="zoneName"
      @close="showCreateModal = false"
      @saved="handleSaved"
    />

    <!-- Delete Confirmation Modal -->
    <WindowsDnsRedirectConfirmDeleteModal
      :is-open="showDeleteModal"
      :is-deleting="isDeleting"
      :message="deleteMessage"
      @close="showDeleteModal = false"
      @confirm="confirmDelete"
    />

    <!-- Bulk Delete Confirmation Modal -->
    <WindowsDnsRedirectConfirmDeleteModal
      :is-open="showBulkDeleteModal"
      :is-deleting="isBulkDeleting"
      :title="t('windowsDns.redirects.confirm.bulk_delete_title', { count: selectedIds.size })"
      :message="t('windowsDns.redirects.confirm.bulk_delete_message', { count: selectedIds.size })"
      @close="showBulkDeleteModal = false"
      @confirm="confirmBulkDelete"
    />

    <!-- Export Modal -->
    <WindowsDnsRedirectExportModal
      :is-open="showExportModal"
      :zone-id="zoneId"
      :filters="filters"
      :has-active-filters="!!(filters.search || filters.type || filters.statusCode !== undefined || filters.isActive !== undefined)"
      @close="showExportModal = false"
    />

    <!-- Import Modal -->
    <WindowsDnsRedirectImportModal
      :is-open="showImportModal"
      :zone-id="zoneId"
      :zone-name="zoneName"
      @close="showImportModal = false"
      @imported="fetchRedirects"
    />

    <!-- Toast Notifications -->
    <WindowsDnsRedirectToastContainer />
  </div>
</template>
