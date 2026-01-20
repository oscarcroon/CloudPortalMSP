<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ t('admin.tenantAdmin.operations.title') }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('admin.tenantAdmin.operations.newsTitle') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('admin.tenantAdmin.operations.newsSubtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="canCreate"
          to="/tenant-admin/operations/news/new"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          <Icon icon="mdi:plus" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.createNews') }}
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

    <!-- News list -->
    <div v-else-if="posts.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="post in posts"
        :key="post.id"
        class="group rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-slate-900/70"
      >
        <!-- Hero image -->
        <div
          v-if="post.heroImageUrl"
          class="h-40 bg-cover bg-center"
          :style="{ backgroundImage: `url(${post.heroImageUrl})` }"
        />
        <div
          v-else
          class="h-40 flex items-center justify-center bg-slate-100 dark:bg-white/5"
        >
          <Icon icon="mdi:image-outline" class="h-12 w-12 text-slate-300 dark:text-slate-600" />
        </div>

        <!-- Content -->
        <div class="p-4">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusBadgeClass(post.status)"
            >
              {{ t(`admin.tenantAdmin.operations.newsStatus.${post.status}`) }}
            </span>
          </div>
          <h3 class="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-brand transition">
            {{ post.title }}
          </h3>
          <p v-if="post.summary" class="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {{ post.summary }}
          </p>
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt) }}
            </span>
            <NuxtLink
              :to="`/tenant-admin/operations/news/${post.id}`"
              class="inline-flex items-center justify-center rounded-lg p-1.5 text-brand transition hover:bg-brand/10 dark:hover:bg-brand/20"
              :title="t('admin.tenantAdmin.operations.edit')"
            >
              <Icon icon="mdi:pencil" class="h-4 w-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-slate-100 p-4 dark:bg-white/10">
        <Icon icon="mdi:newspaper-variant-outline" class="h-12 w-12 text-slate-400" />
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {{ t('admin.tenantAdmin.operations.noNews') }}
      </h3>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.tenantAdmin.operations.noNewsDesc') }}
      </p>
      <NuxtLink
        v-if="canCreate"
        to="/tenant-admin/operations/news/new"
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ t('admin.tenantAdmin.operations.createNews') }}
      </NuxtLink>
    </div>

    <!-- Pagination -->
    <div v-if="nextCursor" class="flex justify-center">
      <button
        class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        @click="loadMore"
      >
        {{ t('common.loadMore') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n, useFetch } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

const filter = ref<'all' | 'draft' | 'published' | 'archived'>('all')

const filterOptions = [
  { value: 'all' as const, label: t('admin.tenantAdmin.operations.allNews') },
  { value: 'published' as const, label: t('admin.tenantAdmin.operations.newsStatus.published') },
  { value: 'draft' as const, label: t('admin.tenantAdmin.operations.newsStatus.draft') },
  { value: 'archived' as const, label: t('admin.tenantAdmin.operations.newsStatus.archived') }
]

const currentTenant = computed(() => auth.currentTenant.value)
const tenantId = computed(() => currentTenant.value?.id)

const canCreate = computed(() => {
  const tenant = currentTenant.value
  if (!tenant) return false
  return tenant.type === 'distributor' || tenant.type === 'provider'
})

interface NewsItem {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  status: 'draft' | 'published' | 'archived'
  publishedAt: string | null
  createdAt: string
}

interface NewsResponse {
  posts: NewsItem[]
  nextCursor: string | null
  tenantType: string
}

const { data, pending, refresh } = useFetch<NewsResponse>(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/news?status=${filter.value}` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId, filter],
    default: () => ({ posts: [], nextCursor: null, tenantType: '' })
  }
)

const posts = computed(() => data.value?.posts ?? [])
const nextCursor = computed(() => data.value?.nextCursor)

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'published': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
    case 'draft': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
    case 'archived': return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
    default: return ''
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', { dateStyle: 'medium' })
}

function loadMore() {
  // TODO: Implement cursor-based pagination
}
</script>

