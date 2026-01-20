<template>
  <div v-if="visibleIncidents.length > 0" class="mx-auto max-w-6xl px-4">
    <!-- Single incident display -->
    <div
      v-if="visibleIncidents.length === 1"
      :class="bannerClasses(visibleIncidents[0].severity)"
      class="mb-4 flex items-start justify-between rounded-lg px-4 py-3 text-sm"
    >
      <div class="flex items-start gap-3 flex-1 min-w-0">
        <Icon :icon="severityIconName(visibleIncidents[0].severity)" class="h-5 w-5 flex-shrink-0 mt-0.5" :class="severityIconClass(visibleIncidents[0].severity)" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span v-if="visibleIncidents[0].isPlanned" class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <Icon icon="mdi:clock-outline" class="h-3 w-3" />
              {{ t('operations.planned') }}
            </span>
            <button
              class="font-semibold hover:underline underline-offset-2 text-left cursor-pointer"
              @click="openIncidentDetails(visibleIncidents[0])"
            >
              {{ visibleIncidents[0].title }}
            </button>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="sourcePillClasses">
              {{ t('operations.from') }} {{ visibleIncidents[0].sourceTenantName }}
            </span>
            <span v-if="visibleIncidents[0].isPlanned && visibleIncidents[0].startsAt" class="text-xs opacity-75">
              {{ formatDate(visibleIncidents[0].startsAt) }}
            </span>
          </div>
          <p v-if="visibleIncidents[0].bodyMarkdown" class="mt-1 text-sm opacity-90 line-clamp-2">
            {{ stripMarkdown(visibleIncidents[0].bodyMarkdown) }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3 ml-3 flex-shrink-0">
        <button
          v-if="showDetails"
          class="text-xs font-medium underline underline-offset-2 hover:opacity-80"
          @click="openIncidentDetails(visibleIncidents[0])"
        >
          {{ t('operations.showDetails') }}
        </button>
        <NuxtLink
          :to="viewAllLink"
          class="text-xs font-medium opacity-70 hover:opacity-100"
        >
          {{ t('operations.viewAll') }}
        </NuxtLink>
        <button
          v-if="canMute"
          class="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
          :title="t('operations.hideForMe')"
          @click="handleMuteIncident(visibleIncidents[0])"
        >
          <Icon icon="mdi:eye-off-outline" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Multiple incidents display -->
    <div
      v-else
      :class="bannerClasses(highestSeverity)"
      class="mb-4 rounded-lg px-4 py-3 text-sm"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Icon :icon="severityIconName(highestSeverity)" class="h-5 w-5 flex-shrink-0" :class="severityIconClass(highestSeverity)" />
          <span class="font-semibold">
            {{ t('operations.multipleIncidents', { count: visibleIncidents.length }) }}
          </span>
        </div>
        <button
          class="text-xs font-medium underline underline-offset-2 hover:opacity-80"
          @click="showAllIncidents = !showAllIncidents"
        >
          {{ showAllIncidents ? t('operations.collapse') : t('operations.expand') }}
        </button>
      </div>

      <!-- Expanded list -->
      <div v-if="showAllIncidents" class="mt-3 space-y-2 border-t border-current/20 pt-3">
        <div
          v-for="incident in visibleIncidents"
          :key="incident.id"
          class="flex items-start justify-between gap-3 rounded-md bg-black/5 dark:bg-white/5 px-3 py-2"
        >
          <div class="flex items-start gap-2 min-w-0 flex-1">
            <Icon :icon="severityIconName(incident.severity)" class="h-4 w-4 flex-shrink-0 mt-0.5" :class="severityIconClass(incident.severity)" />
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="incident.isPlanned" class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  <Icon icon="mdi:clock-outline" class="h-3 w-3" />
                  {{ t('operations.planned') }}
                </span>
                <button
                  class="font-medium hover:underline underline-offset-2 text-left cursor-pointer"
                  @click="openIncidentDetails(incident)"
                >
                  {{ incident.title }}
                </button>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs" :class="sourcePillClasses">
                  {{ incident.sourceTenantName }}
                </span>
                <span v-if="incident.isPlanned && incident.startsAt" class="text-xs opacity-75">
                  {{ formatDate(incident.startsAt) }}
                </span>
              </div>
            </div>
          </div>
          <button
            v-if="canMute"
            class="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity flex-shrink-0"
            :title="t('operations.hideForMe')"
            @click="handleMuteIncident(incident)"
          >
            <Icon icon="mdi:eye-off-outline" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Details modal -->
  <Modal v-if="detailsModalOpen" :show="detailsModalOpen" @close="detailsModalOpen = false">
    <template #title>{{ t('operations.incidentDetails') }}</template>
    <template #content>
      <div v-if="selectedIncident" class="space-y-4">
        <!-- Header: severity, source, created date -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span :class="severityBadgeClasses(selectedIncident.severity)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
              {{ t(`operations.severity.${selectedIncident.severity}`) }}
            </span>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('operations.from') }} {{ selectedIncident.sourceTenantName }}
            </span>
          </div>
          <span class="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Icon icon="mdi:clock-outline" class="h-3.5 w-3.5" />
            {{ formatDate(selectedIncident.createdAt) }}
          </span>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ selectedIncident.title }}</h3>

        <!-- Body -->
        <div
          v-if="selectedIncident.bodyMarkdown"
          class="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-lg prose-h2:mt-3 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-2 prose-h3:mb-1 prose-p:leading-relaxed prose-p:mb-2 prose-a:text-brand prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold prose-code:text-xs prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-blockquote:border-l-brand prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:text-blue-900 dark:prose-blockquote:text-blue-200 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5"
          v-html="renderMarkdown(selectedIncident.bodyMarkdown).html"
        />

        <!-- Time range: starts/ends -->
        <div v-if="selectedIncident.startsAt || selectedIncident.endsAt" class="flex items-center gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          <span v-if="selectedIncident.startsAt" class="inline-flex items-center gap-1.5">
            <Icon icon="mdi:calendar-start" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span class="font-medium">{{ t('operations.startsAt') }}:</span>
            {{ formatDate(selectedIncident.startsAt) }}
          </span>
          <span v-if="selectedIncident.endsAt" class="inline-flex items-center gap-1.5">
            <Icon icon="mdi:calendar-end" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span class="font-medium">{{ t('operations.endsAt') }}:</span>
            {{ formatDate(selectedIncident.endsAt) }}
          </span>
        </div>

        <!-- Actions -->
        <div v-if="canMute" class="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <NuxtLink
            :to="`/incidents/${selectedIncident.slug}`"
            class="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90"
            @click="detailsModalOpen = false"
          >
            <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
            {{ t('operations.showDetails') }}
          </NuxtLink>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
            @click="handleMuteIncident(selectedIncident); detailsModalOpen = false"
          >
            <Icon icon="mdi:bell-off-outline" class="h-4 w-4" />
            {{ t('operations.hideForMe') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '~/composables/useAuth'
import { renderMarkdown } from '~~/shared/markdown'
import Modal from '~/components/shared/Modal.vue'

interface Incident {
  id: string
  title: string
  slug: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: string
  startsAt: Date | string | null
  endsAt: Date | string | null
  createdAt: Date | string
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: string
  isMuted: boolean
  isPlanned?: boolean
}

const props = defineProps<{
  incidents: Incident[]
  showDetails?: boolean
}>()

const emit = defineEmits<{
  mute: [incident: Incident]
}>()

const { t } = useI18n()
const auth = useAuth()

const showAllIncidents = ref(false)
const detailsModalOpen = ref(false)
const selectedIncident = ref<Incident | null>(null)

const visibleIncidents = computed(() =>
  props.incidents.filter((i) => !i.isMuted)
)

const highestSeverity = computed(() => {
  const severityOrder: Record<string, number> = { critical: 0, outage: 1, maintenance: 2, notice: 3, planned: 4 }
  return visibleIncidents.value.reduce((highest, incident) => {
    const currentRank = severityOrder[incident.severity] ?? 999
    const highestRank = severityOrder[highest] ?? 999
    return currentRank < highestRank ? incident.severity : highest
  }, 'notice' as 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned')
})

// Any authenticated user can mute for themselves (personal mute)
const canMute = computed(() => {
  return !!auth.user?.value
})

// Dynamic link based on context - org users go to settings, tenant users go to tenant-admin
const viewAllLink = computed(() => {
  const hasActiveOrg = !!auth.currentOrg?.value
  return hasActiveOrg ? '/settings/operations' : '/tenant-admin/operations/visibility'
})

const sourcePillClasses = 'bg-black/10 text-current dark:bg-white/10'

function bannerClasses(severity: string) {
  const base = 'border'
  switch (severity) {
    case 'critical':
      return `${base} border-red-300 bg-red-50 text-red-800 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-100`
    case 'outage':
      return `${base} border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-100`
    case 'maintenance':
      return `${base} border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-100`
    case 'planned':
      return `${base} border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-100`
    case 'notice':
    default:
      return `${base} border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100`
  }
}

function severityBadgeClasses(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
    case 'outage':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200'
    case 'maintenance':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
    case 'planned':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
    case 'notice':
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
  }
}

function severityIconName(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'mdi:alert-circle'
    case 'outage':
      return 'mdi:alert'
    case 'maintenance':
      return 'mdi:wrench'
    case 'planned':
      return 'mdi:calendar-clock'
    case 'notice':
    default:
      return 'mdi:information'
  }
}

function severityIconClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-600 dark:text-red-400'
    case 'outage':
      return 'text-orange-600 dark:text-orange-400'
    case 'maintenance':
      return 'text-sky-600 dark:text-sky-400'
    case 'planned':
      return 'text-sky-600 dark:text-sky-400'
    case 'notice':
    default:
      return 'text-amber-600 dark:text-amber-400'
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>\[\]()]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 200)
}

function formatDate(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function openDetailsModal() {
  if (visibleIncidents.value.length === 1) {
    selectedIncident.value = visibleIncidents.value[0]
    detailsModalOpen.value = true
  }
}

function openIncidentDetails(incident: Incident) {
  selectedIncident.value = incident
  detailsModalOpen.value = true
}

function handleMuteIncident(incident: Incident) {
  emit('mute', incident)
}
</script>

<style scoped>
/* Additional styling for markdown content in banner */
:deep(.prose code) {
  background-color: rgb(241 245 249);
  color: rgb(30 41 59);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75em;
  font-weight: 500;
}

.dark :deep(.prose code) {
  background-color: rgb(30 41 59);
  color: rgb(226 232 240);
}

:deep(.prose pre) {
  background-color: rgb(30 41 59);
  color: rgb(226 232 240);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-top: 1rem;
  margin-bottom: 1rem;
  font-size: 0.75rem;
}

.dark :deep(.prose pre) {
  background-color: rgb(15 23 42);
}

:deep(.prose pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
  font-size: inherit;
  font-weight: normal;
}

:deep(.prose blockquote) {
  border-left-color: rgb(var(--brand, 28 109 208));
  border-left-width: 3px;
  background-color: rgb(239 246 255);
  padding: 0.5rem 0.75rem;
  margin: 1rem 0;
  border-radius: 0 0.25rem 0.25rem 0;
  color: rgb(30 64 175);
  font-style: italic;
  font-size: 0.875rem;
}

.dark :deep(.prose blockquote) {
  border-left-color: rgb(96 165 250);
  background-color: rgb(30 58 138 / 0.2);
  color: rgb(191 219 254);
}

:deep(.prose blockquote > :first-child) {
  margin-top: 0;
}

:deep(.prose blockquote > :last-child) {
  margin-bottom: 0;
}

:deep(.prose img) {
  border-radius: 0.375rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  max-width: 100%;
  height: auto;
}
</style>
