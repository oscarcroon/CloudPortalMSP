<template>
  <section class="space-y-10">
    <div class="rounded-3xl bg-gradient-to-r from-brand to-brand-dark px-6 py-10 text-white shadow-card">
      <p class="text-sm uppercase tracking-[0.3em] text-white/70">Cloud Portal</p>
      <h1 class="mt-3 text-4xl font-semibold">Single pane of glass</h1>
      <p class="mt-4 max-w-2xl text-white/80">
        Hantera DNS, containrar, virtuella maskiner och WordPress-webbplatser från ett enda gränssnitt.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <StatusPill variant="success" dot>All systems operational</StatusPill>
        <StatusPill variant="info">Organisationer: {{ organisations.length }}</StatusPill>
      </div>
    </div>

    <div v-if="loading" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="i in 6"
        :key="i"
        class="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
    <div v-else-if="modules.length > 0" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <DashboardCard
        v-for="module in modules"
        :key="module.id"
        :title="module.name"
        :description="module.description"
        :badge="module.badge || 'Modul'"
        :icon="module.icon"
        :disabled="module.disabled || false"
        @select="!module.disabled && navigateTo(module.routePath)"
      />
    </div>
    <div v-else class="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
      <Icon icon="mdi:package-variant" class="mx-auto h-12 w-12 text-slate-400" />
      <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Inga moduler är tillgängliga för din organisation.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:chart-line" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Status</h3>
        </div>
        <ul class="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="item in statusItems" :key="item.label" class="flex items-center justify-between">
            <span>{{ item.label }}</span>
            <StatusPill :variant="item.variant" dot>{{ item.value }}</StatusPill>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-colors dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:newspaper-outline" class="h-6 w-6 text-brand" />
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Nyheter</h3>
        </div>
        <ul class="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="post in news" :key="post.title">
            <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ post.date }}</p>
            <p class="mt-1 font-medium text-slate-800 dark:text-slate-100">{{ post.title }}</p>
            <p class="text-slate-500 dark:text-slate-400">{{ post.summary }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import DashboardCard from '~/components/dashboard/DashboardCard.vue'
import { useAuth } from '~/composables/useAuth'
import { useModules } from '~/composables/useModules'

const router = useRouter()
const auth = useAuth()
const { modules, fetchVisibleModules, loading } = useModules()

// Fetch visible modules on mount
onMounted(() => {
  fetchVisibleModules()
})

// Watch for organization changes and refetch modules
watch(() => auth.currentOrg.value?.id, () => {
  fetchVisibleModules()
})

const statusItems = [
  { label: 'Cloudflare API', value: 'OK', variant: 'success' },
  { label: 'Incus cluster', value: 'Degraded', variant: 'warning' },
  { label: 'VM platform', value: 'OK', variant: 'success' },
  { label: 'WordPress', value: 'Maintenance', variant: 'danger' }
] as const

const news = [
  {
    title: 'Din första webbplats? Kom igång smidigt',
    summary: 'Följ våra fem steg för en snabb och säker lansering.',
    date: '28 okt'
  },
  {
    title: 'Hur hänger DNS och e-post ihop?',
    summary: 'Kort guide för SPF, DKIM och MX.',
    date: '14 okt'
  }
]

const organisations = auth.organizations

function navigateTo(path: string) {
  router.push(path)
}
</script>

