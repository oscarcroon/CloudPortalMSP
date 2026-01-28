<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('admin.tenantAdmin.operations.title') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('admin.tenantAdmin.operations.incidentsTitle') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.operations.incidentsSubtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="canCreate"
          to="/tenant-admin/operations/incidents/new"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          <Icon icon="mdi:plus" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.createIncident') }}
        </NuxtLink>
      </div>
    </header>

    <!-- Filter tabs -->
    <div class="flex gap-4 border-b border-slate-200 dark:border-white/10">
      <button
        v-for="filterOption in filterOptions"
        :key="filterOption.value"
        class="relative pb-3 text-sm font-medium transition"
        :class="filter === filterOption.value ? 'text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
        @click="filter = filterOption.value"
      >
        {{ filterOption.label }}
        <span v-if="filter === filterOption.value" class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-12">
      <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
    </div>

    <!-- Incidents list -->
    <div v-else-if="incidents.length > 0" class="space-y-3">
      <div
        v-for="incident in incidents"
        :key="incident.id"
        class="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-900/70"
        :class="incidentBorderClass(incident.severity)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
              :class="incidentBgClass(incident.severity)"
            >
              <Icon :icon="incidentIcon(incident.severity)" class="h-5 w-5" :class="incidentIconClass(incident.severity)" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-semibold text-slate-900 dark:text-slate-100">{{ incident.title }}</h3>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="severityBadgeClass(incident.severity)"
                >
                  {{ t(`operations.severity.${incident.severity}`) }}
                </span>
                <span
                  v-if="incident.status === 'active'"
                  class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                >
                  {{ t('admin.tenantAdmin.operations.status.active') }}
                </span>
                <span
                  v-else-if="incident.status === 'archived'"
                  class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                >
                  <Icon icon="mdi:archive" class="h-3 w-3" />
                  {{ t('admin.tenantAdmin.operations.status.archived') }}
                </span>
              </div>
              <p v-if="incident.bodyMarkdown" class="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                {{ stripMarkdown(incident.bodyMarkdown) }}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span v-if="incident.startsAt">
                  <Icon icon="mdi:calendar-start" class="inline h-3.5 w-3.5 mr-1" />
                  {{ formatDateTime(incident.startsAt) }}
                </span>
                <span v-if="incident.endsAt">
                  <Icon icon="mdi:calendar-end" class="inline h-3.5 w-3.5 mr-1" />
                  {{ formatDateTime(incident.endsAt) }}
                </span>
                <span v-if="incident.createdBy">
                  <Icon icon="mdi:account" class="inline h-3.5 w-3.5 mr-1" />
                  {{ incident.createdBy.fullName || incident.createdBy.email }}
                </span>
                <span>
                  <Icon icon="mdi:clock-outline" class="inline h-3.5 w-3.5 mr-1" />
                  {{ formatDateTime(incident.createdAt) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Resolve button for active incidents -->
            <button
              v-if="incident.status === 'active'"
              class="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-transparent px-3 py-1.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
              :disabled="actionProcessingId === incident.id"
              @click="resolveIncident(incident.id)"
            >
              <Icon v-if="actionProcessingId === incident.id" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <Icon v-else icon="mdi:check-circle" class="h-4 w-4" />
              {{ t('admin.tenantAdmin.operations.markResolved') }}
            </button>
            <!-- Resolved badge -->
            <span
              v-else-if="incident.status === 'resolved'"
              class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-500/20 dark:text-slate-400"
            >
              <Icon icon="mdi:check-circle" class="h-4 w-4" />
              {{ t('admin.tenantAdmin.operations.resolved') }}
            </span>
            <!-- Unarchive button for archived incidents -->
            <button
              v-if="incident.status === 'archived'"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/20 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              :disabled="actionProcessingId === incident.id"
              @click="unarchiveIncident(incident.id)"
            >
              <Icon v-if="actionProcessingId === incident.id" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <Icon v-else icon="mdi:archive-arrow-up" class="h-4 w-4" />
              {{ t('admin.tenantAdmin.operations.unarchive') }}
            </button>
            <!-- Archive button for non-archived incidents -->
            <button
              v-if="incident.status !== 'archived'"
              class="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
              :title="t('admin.tenantAdmin.operations.archive')"
              :disabled="actionProcessingId === incident.id"
              @click="archiveIncident(incident.id)"
            >
              <Icon icon="mdi:archive" class="h-4 w-4" />
            </button>
            <!-- Edit button -->
            <NuxtLink
              :to="`/tenant-admin/operations/incidents/${incident.id}`"
              class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              :title="t('admin.tenantAdmin.operations.edit')"
            >
              <Icon icon="mdi:pencil" class="h-4 w-4" />
            </NuxtLink>
            <!-- Delete button -->
            <button
              class="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              :title="t('common.delete')"
              :disabled="actionProcessingId === incident.id"
              @click="confirmDeleteIncident(incident)"
            >
              <Icon icon="mdi:delete" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-slate-100 p-4 dark:bg-white/10">
        <Icon icon="mdi:check-circle-outline" class="h-12 w-12 text-emerald-500" />
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {{ filter === 'active' ? t('admin.tenantAdmin.operations.noActiveIncidents') : filter === 'archived' ? t('admin.tenantAdmin.operations.noArchivedIncidents') : t('admin.tenantAdmin.operations.noIncidents') }}
      </h3>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.tenantAdmin.operations.noIncidentsDesc') }}
      </p>
      <NuxtLink
        v-if="canCreate"
        to="/tenant-admin/operations/incidents/new"
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ t('admin.tenantAdmin.operations.createIncident') }}
      </NuxtLink>
    </div>

    <!-- Delete confirmation modal -->
    <Modal v-if="deleteConfirmIncident" :show="!!deleteConfirmIncident" @close="deleteConfirmIncident = null">
      <template #title>{{ t('admin.tenantAdmin.operations.deleteIncidentTitle') }}</template>
      <template #content>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('admin.tenantAdmin.operations.deleteConfirmation') }}
        </p>
        <div class="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
          <p class="font-medium text-slate-900 dark:text-slate-100">{{ deleteConfirmIncident.title }}</p>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="deleteConfirmIncident = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="actionProcessingId !== null"
            class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            @click="deleteIncident"
          >
            <Icon v-if="actionProcessingId" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            {{ t('admin.tenantAdmin.operations.confirmDelete') }}
          </button>
        </div>
      </template>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n, useFetch } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import Modal from '~/components/shared/Modal.vue'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

const filter = ref<'active' | 'all' | 'archived'>('active')
const actionProcessingId = ref<string | null>(null)
const deleteConfirmIncident = ref<IncidentItem | null>(null)

const filterOptions = [
  { value: 'active' as const, label: t('admin.tenantAdmin.operations.activeIncidents') },
  { value: 'all' as const, label: t('admin.tenantAdmin.operations.allIncidents') },
  { value: 'archived' as const, label: t('admin.tenantAdmin.operations.archivedIncidents') }
]

const currentTenant = computed(() => auth.currentTenant.value)
const tenantId = computed(() => currentTenant.value?.id)

const canCreate = computed(() => {
  const tenant = currentTenant.value
  if (!tenant) return false
  return tenant.type === 'distributor' || tenant.type === 'provider'
})

interface IncidentItem {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved' | 'archived'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  createdBy: { id: string; email: string; fullName: string | null } | null
}

interface IncidentsResponse {
  incidents: IncidentItem[]
  tenantType: string
}

const { data, pending, refresh } = useFetch<IncidentsResponse>(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/incidents?filter=${filter.value}` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId, filter],
    default: () => ({ incidents: [], tenantType: '' })
  }
)

const incidents = computed(() => data.value?.incidents ?? [])

async function resolveIncident(incidentId: string) {
  if (!tenantId.value || actionProcessingId.value) return
  
  actionProcessingId.value = incidentId
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId}/resolve`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err) {
    console.error('Failed to resolve incident:', err)
  } finally {
    actionProcessingId.value = null
  }
}

async function archiveIncident(incidentId: string) {
  if (!tenantId.value || actionProcessingId.value) return
  
  actionProcessingId.value = incidentId
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId}/archive`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err) {
    console.error('Failed to archive incident:', err)
  } finally {
    actionProcessingId.value = null
  }
}

async function unarchiveIncident(incidentId: string) {
  if (!tenantId.value || actionProcessingId.value) return
  
  actionProcessingId.value = incidentId
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId}/unarchive`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err) {
    console.error('Failed to unarchive incident:', err)
  } finally {
    actionProcessingId.value = null
  }
}

function confirmDeleteIncident(incident: IncidentItem) {
  deleteConfirmIncident.value = incident
}

async function deleteIncident() {
  if (!tenantId.value || !deleteConfirmIncident.value || actionProcessingId.value) return
  
  const incidentId = deleteConfirmIncident.value.id
  actionProcessingId.value = incidentId
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    deleteConfirmIncident.value = null
    await refresh()
  } catch (err) {
    console.error('Failed to delete incident:', err)
  } finally {
    actionProcessingId.value = null
  }
}

function incidentIcon(severity: string): string {
  switch (severity) {
    case 'critical': return 'mdi:alert-circle'
    case 'outage': return 'mdi:alert'
    case 'maintenance': return 'mdi:wrench'
    case 'planned': return 'mdi:calendar-clock'
    default: return 'mdi:information'
  }
}

function incidentIconClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-600 dark:text-red-400'
    case 'outage': return 'text-orange-600 dark:text-orange-400'
    case 'maintenance':
    case 'planned': return 'text-blue-600 dark:text-blue-400'
    default: return 'text-amber-600 dark:text-amber-400'
  }
}

function incidentBgClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 dark:bg-red-500/20'
    case 'outage': return 'bg-orange-100 dark:bg-orange-500/20'
    case 'maintenance':
    case 'planned': return 'bg-blue-100 dark:bg-blue-500/20'
    default: return 'bg-amber-100 dark:bg-amber-500/20'
  }
}

function incidentBorderClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-200 dark:border-red-500/30'
    case 'outage': return 'border-orange-200 dark:border-orange-500/30'
    case 'maintenance':
    case 'planned': return 'border-blue-200 dark:border-blue-500/30'
    default: return 'border-slate-200 dark:border-white/10'
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    case 'outage': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
    case 'maintenance':
    case 'planned': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    default: return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>\[\]()]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 200)
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

