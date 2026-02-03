<template>
  <section class="mx-auto max-w-5xl space-y-8">
    <!-- Top nav -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400 dark:hover:text-brand"
      >
        <Icon icon="heroicons:arrow-left" class="h-4 w-4" />
        {{ t('incident.backToDashboard') }}
      </NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="space-y-4">
      <div class="h-10 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
      <div class="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
      <div class="h-64 w-full animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-700"></div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="rounded-3xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-800/50 dark:bg-red-900/20"
    >
      <Icon icon="heroicons:exclamation-circle" class="mx-auto h-12 w-12 text-red-400" />
      <p class="mt-4 text-red-700 dark:text-red-300">{{ t('incident.notFound') }}</p>
      <NuxtLink to="/" class="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        {{ t('incident.backToDashboard') }}
      </NuxtLink>
    </div>

    <!-- Incident content -->
    <div v-else-if="incident" class="space-y-8">
      <!-- Header -->
      <header class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div
          class="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10"
          :class="severityBgClass"
        >
          <!-- Pattern background -->
          <div class="pointer-events-none absolute inset-0 overflow-hidden">
            <div class="absolute -left-[10%] -top-[20%] h-[150%] w-[50%] rounded-full opacity-20 blur-[120px]" :class="severityGlowClass"></div>
            <div class="absolute -right-[10%] -bottom-[20%] h-[120%] w-[40%] rounded-full bg-slate-400/10 blur-[100px] dark:bg-slate-600/10"></div>
            
            <div
              class="absolute inset-[-100%] opacity-[0.06] dark:opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]"
              style="
                background-image: 
                  linear-gradient(to right, currentColor 1px, transparent 1px), 
                  linear-gradient(to bottom, currentColor 1px, transparent 1px),
                  linear-gradient(to right, currentColor 1.5px, transparent 1px), 
                  linear-gradient(to bottom, currentColor 1.5px, transparent 1px);
                background-size: 40px 40px, 40px 40px, 120px 120px, 120px 120px;
                transform: rotate(-12deg);
              "
            ></div>
          </div>
          
          <div class="relative">
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <!-- Severity badge -->
              <span
                :class="[
                  'rounded-full px-2.5 py-1 font-medium ring-1',
                  severityBadgeClass
                ]"
              >
                {{ t(`operations.severity.${incident.severity}`) }}
              </span>
              
              <!-- Status badge -->
              <span
                :class="[
                  'rounded-full px-2.5 py-1 font-medium ring-1',
                  statusBadgeClass
                ]"
              >
                {{ t(`incident.status.${incident.status}`) }}
              </span>

              <!-- Source tenant -->
              <span
                :class="[
                  'rounded-full px-2.5 py-1 font-medium ring-1',
                  incident.sourceTenant.type === 'distributor'
                    ? 'bg-purple-500/10 text-purple-700 ring-purple-500/20 dark:bg-purple-500/15 dark:text-purple-200 dark:ring-purple-400/20'
                    : 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20'
                ]"
              >
                {{ incident.sourceTenant.type === 'distributor' ? t('incident.distributor') : t('incident.provider') }}
              </span>
              <span class="text-slate-600 dark:text-slate-300">{{ incident.sourceTenant.name }}</span>
            </div>

            <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {{ incident.title }}
            </h1>

            <!-- Time info -->
            <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div v-if="incident.startsAt" class="flex items-center gap-1.5">
                <Icon icon="heroicons:calendar" class="h-4 w-4" />
                <span>{{ t('operations.startsAt') }}: {{ formatDateTime(incident.startsAt) }}</span>
              </div>
              <div v-if="incident.endsAt" class="flex items-center gap-1.5">
                <Icon icon="heroicons:calendar-days" class="h-4 w-4" />
                <span>{{ t('operations.endsAt') }}: {{ formatDateTime(incident.endsAt) }}</span>
              </div>
              <div v-if="incident.resolvedAt" class="flex items-center gap-1.5">
                <Icon icon="heroicons:check-circle" class="h-4 w-4 text-green-500" />
                <span>{{ t('incident.resolvedAt') }}: {{ formatDateTime(incident.resolvedAt) }}</span>
              </div>
              <div v-if="!incident.startsAt && !incident.resolvedAt" class="flex items-center gap-1.5">
                <Icon icon="heroicons:clock" class="h-4 w-4" />
                <span>{{ t('operations.createdAt') }}: {{ formatDateTime(incident.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Body -->
      <article
        v-if="incident.bodyMarkdown"
        class="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70 sm:p-10"
      >
        <div
          class="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-brand prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold prose-code:text-sm prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-blockquote:border-l-brand prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:text-blue-900 dark:prose-blockquote:text-blue-200 prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
          v-html="renderedBody"
        ></div>
      </article>

      <!-- Prev/Next navigation -->
      <div v-if="navigation.previous || navigation.next" class="grid gap-4 sm:grid-cols-2">
        <NuxtLink
          v-if="navigation.previous"
          :to="`/incidents/${navigation.previous.slug}`"
          class="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-brand/50"
        >
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon icon="heroicons:arrow-left" class="h-4 w-4" />
            {{ t('incident.previous') }}
          </div>
          <div class="mt-2 line-clamp-2 font-medium text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
            {{ navigation.previous.title }}
          </div>
        </NuxtLink>

        <NuxtLink
          v-if="navigation.next"
          :to="`/incidents/${navigation.next.slug}`"
          class="group rounded-2xl border border-slate-200 bg-white p-5 text-right transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-brand/50"
        >
          <div class="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
            {{ t('incident.next') }}
            <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
          </div>
          <div class="mt-2 line-clamp-2 font-medium text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
            {{ navigation.next.title }}
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { renderMarkdown } from '~~/shared/markdown'

interface Incident {
  id: string
  title: string
  slug: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'maintenance' | 'notice' | 'planned'
  status: 'active' | 'resolved' | 'closed'
  startsAt: string | null
  endsAt: string | null
  resolvedAt: string | null
  createdAt: string
  sourceTenant: {
    id: string
    name: string
    type: 'provider' | 'distributor' | 'organization'
  }
}

interface IncidentResponse {
  incident: Incident
  navigation: {
    previous: { title: string; slug: string } | null
    next: { title: string; slug: string } | null
  }
}

const { t } = useI18n()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const { data, pending, error } = await (useFetch as any)(
  () => `/api/operations/incidents/${slug.value}`,
  {
    credentials: 'include'
  }
)

const incident = computed(() => data.value?.incident ?? null)
const navigation = computed(() => data.value?.navigation ?? { previous: null, next: null })

const renderedBody = computed(() => {
  if (!incident.value?.bodyMarkdown) return ''
  return renderMarkdown(incident.value.bodyMarkdown).html
})

// Severity-based styling
const severityBgClass = computed(() => {
  const severity = incident.value?.severity
  switch (severity) {
    case 'critical':
      return 'bg-gradient-to-br from-red-500/5 via-slate-50 to-slate-200 dark:from-red-500/10 dark:via-slate-900 dark:to-slate-950'
    case 'outage':
      return 'bg-gradient-to-br from-orange-500/5 via-slate-50 to-slate-200 dark:from-orange-500/10 dark:via-slate-900 dark:to-slate-950'
    case 'maintenance':
    case 'planned':
      return 'bg-gradient-to-br from-blue-500/5 via-slate-50 to-slate-200 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-950'
    default:
      return 'bg-gradient-to-br from-brand/5 via-slate-50 to-slate-200 dark:from-brand/10 dark:via-slate-900 dark:to-slate-950'
  }
})

const severityGlowClass = computed(() => {
  const severity = incident.value?.severity
  switch (severity) {
    case 'critical':
      return 'bg-red-500'
    case 'outage':
      return 'bg-orange-500'
    case 'maintenance':
    case 'planned':
      return 'bg-blue-500'
    default:
      return 'bg-brand'
  }
})

const severityBadgeClass = computed(() => {
  const severity = incident.value?.severity
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-700 ring-red-500/20 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/20'
    case 'outage':
      return 'bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-400/20'
    case 'maintenance':
    case 'planned':
      return 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20'
    default:
      return 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/20'
  }
})

const statusBadgeClass = computed(() => {
  const status = incident.value?.status
  switch (status) {
    case 'resolved':
      return 'bg-green-500/10 text-green-700 ring-green-500/20 dark:bg-green-500/15 dark:text-green-200 dark:ring-green-400/20'
    case 'closed':
      return 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/20'
    default:
      return 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20'
  }
})

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Page meta
useHead({
  title: computed(() => incident.value?.title ?? t('incident.title'))
})
</script>

<style scoped>
/* Additional styling for markdown content */
:deep(.prose code) {
  background-color: rgb(241 245 249);
  color: rgb(30 41 59);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-weight: 500;
}

.dark :deep(.prose code) {
  background-color: rgb(30 41 59);
  color: rgb(226 232 240);
}

:deep(.prose pre) {
  background-color: rgb(30 41 59);
  color: rgb(226 232 240);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}

.dark :deep(.prose pre) {
  background-color: rgb(15 23 42);
}

:deep(.prose pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
  font-size: 0.875rem;
  font-weight: normal;
}

:deep(.prose blockquote) {
  border-left-color: rgb(var(--brand, 28 109 208));
  border-left-width: 4px;
  background-color: rgb(239 246 255);
  padding: 0.75rem 1rem;
  margin: 1.5rem 0;
  border-radius: 0 0.375rem 0.375rem 0;
  color: rgb(30 64 175);
  font-style: italic;
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
  border-radius: 0.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  max-width: 100%;
  height: auto;
}

:deep(.prose hr) {
  border-color: rgb(226 232 240);
  margin: 2rem 0;
}

.dark :deep(.prose hr) {
  border-color: rgb(51 65 85);
}

:deep(.prose table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}

:deep(.prose table th),
:deep(.prose table td) {
  border: 1px solid rgb(226 232 240);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.dark :deep(.prose table th),
.dark :deep(.prose table td) {
  border-color: rgb(51 65 85);
}

:deep(.prose table th) {
  background-color: rgb(241 245 249);
  font-weight: 600;
}

.dark :deep(.prose table th) {
  background-color: rgb(30 41 59);
}
</style>

