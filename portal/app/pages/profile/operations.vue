<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/profile"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('profile.title') }}
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('profile.operations.title') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('profile.operations.subtitle') }}
        </p>
      </div>
    </header>

    <ClientOnly>
      <div v-if="loading" class="flex items-center justify-center py-12">
        <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
        <span class="ml-3 text-sm text-slate-500">{{ t('profile.operations.loading') }}</span>
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
            <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
              {{ t('profile.sections.operations') }}
            </h2>
          </div>

          <div v-if="hiddenIncidents.length === 0" class="px-6 py-8 text-center">
            <Icon icon="mdi:check-circle-outline" class="mx-auto h-12 w-12 text-emerald-500" />
            <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {{ t('profile.operations.noHiddenIncidents') }}
            </p>
          </div>

          <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
            <div
              v-for="incident in hiddenIncidents"
              :key="incident.id"
              class="flex items-center justify-between gap-4 px-6 py-4"
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
                    <p class="font-medium text-slate-700 dark:text-slate-300">{{ incident.title }}</p>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="severityBadgeClass(incident.severity)"
                    >
                      {{ t(`operations.severity.${incident.severity}`) }}
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
                  class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                  :disabled="mutingId === incident.id"
                  @click="showAgain(incident.id)"
                >
                  <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                  <Icon v-else icon="mdi:bell-outline" class="h-3.5 w-3.5" />
                  {{ t('profile.operations.showAgain') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()

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

// Only show incidents that are hidden by the user personally (not scope-muted)
const hiddenIncidents = computed(() => incidents.value.filter((i) => i.isUserMuted))

async function fetchIncidents() {
  loading.value = true
  try {
    const response = await ($fetch as any)('/api/operations/incidents?includeMuted=1', {
      credentials: 'include'
    })
    incidents.value = response.incidents
  } catch (err) {
    console.error('Failed to fetch incidents:', err)
  } finally {
    loading.value = false
  }
}

async function showAgain(incidentId: string) {
  mutingId.value = incidentId
  try {
    await ($fetch as any)(`/api/operations/incidents/${incidentId}/unmute`, {
      method: 'POST',
      credentials: 'include'
    })
    await fetchIncidents()
    // Refresh operations feed in layout (banner)
    const { refreshOperationsFeed } = await import('~/composables/useOperationsFeed')
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to show incident:', err)
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
</script>

