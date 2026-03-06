<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('operationsPage.title') }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ t('operationsPage.subtitle') }}
      </p>
    </header>

    <ClientOnly>
      <!-- ACTIVE INCIDENTS -->
      <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('operationsPage.incidentsTitle') }}
          </h2>
        </div>

        <div v-if="loadingIncidents" class="flex items-center justify-center py-12">
          <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
          <span class="ml-3 text-sm text-slate-500">{{ t('operationsPage.loading') }}</span>
        </div>

        <template v-else>
          <!-- No active incidents -->
          <div v-if="visibleIncidents.length === 0" class="px-6 py-8 text-center">
            <Icon icon="mdi:check-circle-outline" class="mx-auto h-12 w-12 text-emerald-500" />
            <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {{ t('operationsPage.noActiveIncidents') }}
            </p>
          </div>

          <!-- Incident list -->
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
                    <NuxtLink
                      v-if="incident.slug"
                      :to="`/incidents/${incident.slug}`"
                      class="font-medium text-slate-900 hover:text-brand hover:underline underline-offset-2 dark:text-slate-100 dark:hover:text-brand"
                    >
                      {{ incident.title }}
                    </NuxtLink>
                    <p v-else class="font-medium text-slate-900 dark:text-slate-100">{{ incident.title }}</p>
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
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  :disabled="mutingId === incident.id"
                  @click="hideForMe(incident.id)"
                >
                  <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                  <Icon v-else icon="mdi:bell-off-outline" class="h-3.5 w-3.5" />
                  {{ t('operationsPage.hideForMe') }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- HIDDEN INCIDENTS (expandable) -->
      <div v-if="!loadingIncidents && hiddenIncidents.length > 0" class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
        <button
          class="flex w-full items-center justify-between border-b border-slate-200 px-6 py-4 text-left dark:border-white/5"
          @click="showHidden = !showHidden"
        >
          <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('operationsPage.hiddenIncidents') }}
            <span class="ml-2 text-xs font-normal text-slate-500">({{ hiddenIncidents.length }})</span>
          </h2>
          <Icon
            :icon="showHidden ? 'mdi:chevron-up' : 'mdi:chevron-down'"
            class="h-5 w-5 text-slate-400"
          />
        </button>

        <div v-if="showHidden" class="divide-y divide-slate-100 dark:divide-white/5">
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
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ t('operations.from') }} {{ incident.sourceTenantName }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                :disabled="mutingId === incident.id"
                @click="showForMe(incident.id)"
              >
                <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                <Icon v-else icon="mdi:bell-outline" class="h-3.5 w-3.5" />
                {{ t('operationsPage.showForMe') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No hidden incidents message (only shown when there are visible incidents but no hidden) -->

      <!-- LATEST NEWS -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('operationsPage.newsTitle') }}
          </h2>
          <NuxtLink
            to="/news"
            class="text-sm font-medium text-brand hover:underline underline-offset-2"
          >
            {{ t('operationsPage.viewAllNews') }} →
          </NuxtLink>
        </div>

        <div v-if="loadingNews" class="grid gap-6 md:grid-cols-2">
          <div
            v-for="i in 4"
            :key="i"
            class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#0c1524]"
          >
            <div class="h-32 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div class="mt-4 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div class="mt-2 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>

        <div v-else-if="newsPosts.length > 0" class="grid gap-6 md:grid-cols-2">
          <NuxtLink
            v-for="post in newsPosts"
            :key="post.id"
            :to="`/news/${post.slug}`"
            class="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand/30 hover:shadow-lg dark:border-white/10 dark:bg-[#0c1524] dark:hover:border-brand/50"
          >
            <!-- Hero image -->
            <div
              v-if="post.heroImageUrl"
              class="aspect-video w-full bg-slate-100 dark:bg-slate-700"
            >
              <img
                :src="post.heroImageUrl"
                :alt="post.title"
                class="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div
              v-else
              class="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800"
            >
              <Icon icon="heroicons:newspaper" class="h-12 w-12 text-slate-300 dark:text-slate-600" />
            </div>

            <!-- Content -->
            <div class="p-5">
              <div class="flex items-center gap-2 text-xs">
                <span class="text-slate-400 dark:text-slate-500">{{ post.sourceTenantName }}</span>
                <span v-if="post.publishedAt" class="text-slate-300 dark:text-slate-600">•</span>
                <span v-if="post.publishedAt" class="text-slate-400 dark:text-slate-500">{{ formatDate(post.publishedAt) }}</span>
              </div>
              <h3 class="mt-3 text-lg font-semibold text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
                {{ post.title }}
              </h3>
              <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                {{ post.summary }}
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- Empty news state -->
        <div
          v-else
          class="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-[#0c1524]"
        >
          <Icon icon="heroicons:newspaper" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p class="mt-4 text-slate-600 dark:text-slate-400">{{ t('operationsPage.noNews') }}</p>
        </div>
      </div>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { refreshOperationsFeed } from '~/composables/useOperationsFeed'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()

// ========== INCIDENTS ==========
interface UpstreamIncident {
  id: string
  title: string
  slug?: string
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

const loadingIncidents = ref(true)
const mutingId = ref<string | null>(null)
const incidents = ref<UpstreamIncident[]>([])
const showHidden = ref(false)

const visibleIncidents = computed(() => incidents.value.filter((i) => !i.isMuted))
const hiddenIncidents = computed(() => incidents.value.filter((i) => i.isMuted))

async function fetchIncidents() {
  loadingIncidents.value = true
  try {
    const response = await ($fetch as any)('/api/operations/incidents?includeMuted=1', {
      credentials: 'include'
    })
    incidents.value = response.incidents
  } catch (err) {
    console.error('Failed to fetch incidents:', err)
  } finally {
    loadingIncidents.value = false
  }
}

async function hideForMe(incidentId: string) {
  mutingId.value = incidentId
  try {
    await ($fetch as any)(`/api/operations/incidents/${incidentId}/mute`, { method: 'POST', credentials: 'include' })
    await fetchIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to hide incident:', err)
  } finally {
    mutingId.value = null
  }
}

async function showForMe(incidentId: string) {
  mutingId.value = incidentId
  try {
    await ($fetch as any)(`/api/operations/incidents/${incidentId}/unmute`, { method: 'POST', credentials: 'include' })
    await fetchIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to show incident:', err)
  } finally {
    mutingId.value = null
  }
}

// ========== NEWS ==========
interface NewsPost {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  publishedAt: string | null
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: string
}

const loadingNews = ref(true)
const newsPosts = ref<NewsPost[]>([])

async function fetchNews() {
  loadingNews.value = true
  try {
    const response = await ($fetch as any)('/api/operations/news?limit=6', {
      credentials: 'include'
    })
    newsPosts.value = response.posts ?? []
  } catch (err) {
    console.error('Failed to fetch news:', err)
  } finally {
    loadingNews.value = false
  }
}

// ========== HELPERS ==========
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
  fetchNews()
})
</script>
