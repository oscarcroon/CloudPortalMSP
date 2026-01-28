<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('admin.tenantAdmin.operations.title') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('admin.tenantAdmin.operations.visibilityTitle') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.operations.visibilitySubtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/tenant-admin/operations/incidents"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:format-list-bulleted" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.manageAll') }}
        </NuxtLink>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
    </div>

    <div v-else class="space-y-6">
      <!-- Active incidents from upstream (that we receive) -->
      <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('admin.tenantAdmin.operations.activeIncidents') }}
          </h2>
        </div>

        <div v-if="visibleIncidents.length === 0" class="px-6 py-8 text-center">
          <Icon icon="mdi:check-circle-outline" class="mx-auto h-12 w-12 text-emerald-500" />
          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {{ t('admin.tenantAdmin.operations.noActiveIncidents') }}
          </p>
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
          <div
            v-for="incident in visibleIncidents"
            :key="incident.id"
            class="flex items-center justify-between gap-4 px-6 py-4"
          >
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                :class="severityBgClass(incident.severity)"
              >
                <Icon :icon="severityIcon(incident.severity)" class="h-5 w-5" :class="severityIconClass(incident.severity)" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-medium text-slate-900 dark:text-slate-100">{{ incident.title }}</p>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="severityBadgeClass(incident.severity)"
                  >
                    {{ t(`operations.severity.${incident.severity}`) }}
                  </span>
                  <span v-if="incident.isPlanned" class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                    <Icon icon="mdi:clock-outline" class="h-3 w-3" />
                    {{ t('operations.planned') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ t('operations.from') }} {{ incident.sourceTenantName }}
                  <span v-if="incident.startsAt"> · {{ formatDate(incident.startsAt) }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                :disabled="mutingId === incident.id"
                @click="hideForTenant(incident.id)"
              >
                <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                <Icon v-else icon="mdi:eye-off-outline" class="h-3.5 w-3.5" />
                {{ t('admin.tenantAdmin.operations.hideForTenant') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden incidents at tenant level -->
      <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-slate-900/70">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('admin.tenantAdmin.operations.hiddenForTenant') }}
          </h2>
        </div>

        <div v-if="hiddenIncidents.length === 0" class="px-6 py-8 text-center">
          <Icon icon="mdi:eye-outline" class="mx-auto h-12 w-12 text-slate-400" />
          <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {{ t('admin.tenantAdmin.operations.noHiddenForTenant') }}
          </p>
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
          <div
            v-for="incident in hiddenIncidents"
            :key="incident.id"
            class="flex items-center justify-between gap-4 px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02]"
          >
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg opacity-60"
                :class="severityBgClass(incident.severity)"
              >
                <Icon :icon="severityIcon(incident.severity)" class="h-5 w-5" :class="severityIconClass(incident.severity)" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-medium text-slate-600 dark:text-slate-400">{{ incident.title }}</p>
                  <span
                    v-if="incident.isScopeMuted"
                    class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                  >
                    {{ t('admin.tenantAdmin.operations.hiddenForTenant') }}
                  </span>
                  <span
                    v-if="incident.isUserMuted"
                    class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-400"
                  >
                    {{ t('admin.tenantAdmin.operations.hiddenForUser') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ t('operations.from') }} {{ incident.sourceTenantName }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                v-if="incident.isScopeMuted"
                class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                :disabled="mutingId === incident.id"
                @click="showForTenant(incident.id)"
              >
                <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                <Icon v-else icon="mdi:eye-outline" class="h-3.5 w-3.5" />
                {{ t('admin.tenantAdmin.operations.showForTenant') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

interface IncidentItem {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: string
  isUserMuted: boolean
  isScopeMuted: boolean
  isMuted: boolean
  isPlanned: boolean
}

interface IncidentsResponse {
  incidents: IncidentItem[]
  context: {
    type: string
    orgId?: string
    tenantId?: string
    sourceCount: number
  }
}

const loading = ref(true)
const mutingId = ref<string | null>(null)
const incidents = ref<IncidentItem[]>([])

const visibleIncidents = computed(() => incidents.value.filter((i) => !i.isMuted))
const hiddenIncidents = computed(() => incidents.value.filter((i) => i.isMuted))

const currentTenant = computed(() => auth.currentTenant.value)

async function fetchIncidents() {
  loading.value = true
  try {
    const response = await $fetch<IncidentsResponse>('/api/operations/incidents?includeMuted=1', {
      credentials: 'include'
    })
    incidents.value = response.incidents
  } catch (err) {
    console.error('Failed to fetch incidents:', err)
  } finally {
    loading.value = false
  }
}

async function hideForTenant(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/admin/incidents/${incidentId}/mute`, {
      method: 'POST',
      body: { targetType: 'tenant' },
      credentials: 'include'
    })
    await fetchIncidents()
  } catch (err) {
    console.error('Failed to hide incident for tenant:', err)
  } finally {
    mutingId.value = null
  }
}

async function showForTenant(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/admin/incidents/${incidentId}/unmute`, {
      method: 'POST',
      body: { targetType: 'tenant' },
      credentials: 'include'
    })
    await fetchIncidents()
    // Refresh operations feed in layout (banner)
    const { refreshOperationsFeed } = await import('~/composables/useOperationsFeed')
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to show incident for tenant:', err)
  } finally {
    mutingId.value = null
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return 'mdi:alert-circle'
    case 'outage': return 'mdi:alert'
    case 'maintenance': return 'mdi:wrench'
    case 'planned': return 'mdi:calendar-clock'
    default: return 'mdi:information'
  }
}

function severityIconClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-600 dark:text-red-400'
    case 'outage': return 'text-orange-600 dark:text-orange-400'
    case 'maintenance':
    case 'planned': return 'text-blue-600 dark:text-blue-400'
    default: return 'text-amber-600 dark:text-amber-400'
  }
}

function severityBgClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 dark:bg-red-500/20'
    case 'outage': return 'bg-orange-100 dark:bg-orange-500/20'
    case 'maintenance':
    case 'planned': return 'bg-blue-100 dark:bg-blue-500/20'
    default: return 'bg-amber-100 dark:bg-amber-500/20'
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

onMounted(() => {
  fetchIncidents()
})

// Refetch when tenant changes
watch(currentTenant, () => {
  fetchIncidents()
})
</script>

