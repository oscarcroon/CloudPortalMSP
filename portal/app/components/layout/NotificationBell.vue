<template>
  <div ref="container" class="relative">
    <!-- Bell button -->
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      :aria-label="t('notifications.label')"
      :title="t('notifications.label')"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
      @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
      @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
    >
      <Icon icon="mdi:bell-outline" class="h-5 w-5" />

      <!-- Badge -->
      <span
        v-if="notifications.hasUnread.value"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
        :style="{ backgroundColor: accentColor }"
      >
        {{ notifications.badgeText.value }}
      </span>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open"
        role="menu"
        class="absolute right-0 top-full z-[60] mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
            {{ t('notifications.title') }}
          </h3>
          <button
            v-if="notifications.hasUnread.value"
            type="button"
            class="text-xs text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="handleMarkAllRead"
          >
            {{ t('notifications.markAllRead') }}
          </button>
        </div>

        <!-- Content -->
        <div class="max-h-96 overflow-y-auto">
          <!-- Empty state -->
          <div
            v-if="notifications.recentIncidents.value.length === 0 && notifications.recentNews.value.length === 0"
            class="flex flex-col items-center justify-center px-4 py-8 text-slate-400 dark:text-slate-500"
          >
            <Icon icon="mdi:bell-off-outline" class="mb-2 h-10 w-10" />
            <span class="text-sm">{{ t('notifications.empty') }}</span>
          </div>

          <!-- Incidents section -->
          <div v-if="notifications.recentIncidents.value.length > 0">
            <div class="px-4 py-2">
              <span class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {{ t('notifications.incidents') }}
              </span>
            </div>
            <div class="space-y-1 px-2 pb-2">
              <NuxtLink
                v-for="incident in displayedIncidents"
                :key="incident.id"
                :to="`/operations/incidents/${incident.id}`"
                class="flex items-start gap-3 rounded-md px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                :class="{ 'bg-slate-50 dark:bg-slate-700/30': notifications.isIncidentUnread(incident) }"
                @click="open = false"
              >
                <span
                  class="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                  :class="severityDotClass(incident.severity)"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {{ incident.title }}
                  </p>
                  <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span class="truncate">{{ incident.sourceTenantName }}</span>
                    <span class="flex-shrink-0">{{ relativeTime(incident.createdAt) }}</span>
                  </div>
                </div>
                <span
                  v-if="notifications.isIncidentUnread(incident)"
                  class="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                  :style="{ backgroundColor: accentColor }"
                />
              </NuxtLink>
            </div>
          </div>

          <!-- News section -->
          <div v-if="notifications.recentNews.value.length > 0">
            <div class="px-4 py-2" :class="{ 'border-t border-slate-100 dark:border-slate-700': notifications.recentIncidents.value.length > 0 }">
              <span class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {{ t('notifications.news') }}
              </span>
            </div>
            <div class="space-y-1 px-2 pb-2">
              <NuxtLink
                v-for="news in displayedNews"
                :key="news.id"
                :to="`/operations/news/${news.slug}`"
                class="flex items-start gap-3 rounded-md px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                :class="{ 'bg-slate-50 dark:bg-slate-700/30': notifications.isNewsUnread(news) }"
                @click="open = false"
              >
                <Icon icon="mdi:newspaper-variant-outline" class="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {{ news.title }}
                  </p>
                  <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span class="truncate">{{ news.sourceTenantName }}</span>
                    <span v-if="news.publishedAt" class="flex-shrink-0">{{ relativeTime(news.publishedAt) }}</span>
                  </div>
                </div>
                <span
                  v-if="notifications.isNewsUnread(news)"
                  class="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                  :style="{ backgroundColor: accentColor }"
                />
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-100 px-4 py-2 dark:border-slate-700">
          <NuxtLink
            to="/operations"
            class="block text-center text-xs font-medium transition hover:underline"
            :style="{ color: accentColor }"
            @click="open = false"
          >
            {{ t('notifications.viewAll') }}
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from '#imports'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { useNotifications } from '~/composables/useNotifications'

const { t } = useI18n()
const auth = useAuth()
const notifications = useNotifications()

const open = ref(false)
const container = ref<HTMLElement>()

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

// Show max 5 items in dropdown
const displayedIncidents = computed(() => notifications.recentIncidents.value.slice(0, 5))
const displayedNews = computed(() => notifications.recentNews.value.slice(0, 5))

function toggle() {
  open.value = !open.value
}

// When dropdown opens, mark as seen
watch(open, (isOpen) => {
  if (isOpen) {
    notifications.markAllSeen()
  }
})

function handleMarkAllRead() {
  notifications.markAllSeen()
}

function severityDotClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500'
    case 'outage':
      return 'bg-orange-500'
    case 'maintenance':
      return 'bg-sky-500'
    case 'planned':
      return 'bg-sky-500'
    case 'notice':
    default:
      return 'bg-amber-500'
  }
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return t('notifications.justNow')
  if (diffMins < 60) return t('notifications.minutesAgo', { count: diffMins })
  if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours })
  return t('notifications.daysAgo', { count: diffDays })
}

const handleClickOutside = (event: MouseEvent) => {
  if (container.value && !container.value.contains(event.target as Node)) {
    open.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>
