<template>
  <section class="mx-auto max-w-4xl space-y-8">
    <!-- Header -->
    <header>
      <NuxtLink
        to="/"
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400 dark:hover:text-brand"
      >
        <Icon icon="heroicons:arrow-left" class="h-4 w-4" />
        {{ t('news.backToDashboard') }}
      </NuxtLink>
      <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
        {{ t('news.allNews') }}
      </h1>
      <p class="mt-2 text-slate-600 dark:text-slate-400">
        {{ t('news.allNewsDescription') }}
      </p>
    </header>

    <!-- Filter tabs -->
    <div class="flex gap-2">
      <button
        v-for="filterOption in filterOptions"
        :key="filterOption.value"
        :class="[
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          filter === filterOption.value
            ? 'bg-brand text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
        ]"
        @click="filter = filterOption.value"
      >
        {{ filterOption.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="pending && !posts.length" class="grid gap-6 md:grid-cols-2">
      <div
        v-for="i in 4"
        :key="i"
        class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
      >
        <div class="h-32 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div class="mt-4 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div class="mt-2 h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>

    <!-- News grid -->
    <div v-else-if="filteredPosts.length > 0" class="grid gap-6 md:grid-cols-2">
      <NuxtLink
        v-for="post in filteredPosts"
        :key="post.id"
        :to="`/news/${post.slug}`"
        class="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand/30 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand/50"
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
            <span
              :class="[
                'rounded-full px-2 py-0.5 font-medium',
                post.sourceTenant.type === 'distributor'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              ]"
            >
              {{ post.sourceTenant.type === 'distributor' ? t('news.distributor') : t('news.provider') }}
            </span>
            <span class="text-slate-400 dark:text-slate-500">{{ post.sourceTenant.name }}</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <span class="text-slate-400 dark:text-slate-500">{{ formatDate(post.publishedAt) }}</span>
          </div>
          <h2 class="mt-3 text-lg font-semibold text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
            {{ post.title }}
          </h2>
          <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
            {{ post.summary }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800"
    >
      <Icon icon="heroicons:newspaper" class="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
      <p class="mt-4 text-slate-600 dark:text-slate-400">{{ t('news.noNewsYet') }}</p>
    </div>

    <!-- Load more button -->
    <div v-if="hasMore" class="flex justify-center">
      <button
        :disabled="loadingMore"
        class="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        @click="loadMore"
      >
        <Icon v-if="loadingMore" icon="heroicons:arrow-path" class="h-4 w-4 animate-spin" />
        {{ loadingMore ? t('common.loading') : t('common.loadMore') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'

interface NewsPost {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  publishedAt: string | null
  sourceTenant: {
    id: string
    name: string
    type: 'provider' | 'distributor' | 'organization'
  }
}

interface NewsListResponse {
  posts: NewsPost[]
  nextCursor: string | null
  hasMore: boolean
}

const { t } = useI18n()

type FilterType = 'all' | 'distributor' | 'provider'
const filter = ref<FilterType>('all')

const filterOptions = computed(() => [
  { value: 'all' as const, label: t('news.filterAll') },
  { value: 'distributor' as const, label: t('news.distributor') },
  { value: 'provider' as const, label: t('news.provider') }
])

const additionalPosts = ref<NewsPost[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const loadingMore = ref(false)

const { data, pending, error } = await (useFetch as any)(
  '/api/operations/news',
  {
    query: { limit: 10 },
    credentials: 'include'
  }
)

// Combine initial data with additional loaded posts
const posts = computed(() => {
  const initial = data.value?.posts ?? []
  return [...initial, ...additionalPosts.value]
})

// Update pagination state when data changes
watch(data, (newData) => {
  if (newData) {
    nextCursor.value = newData.nextCursor
    hasMore.value = newData.hasMore
  }
}, { immediate: true })

// Filter posts client-side
const filteredPosts = computed(() => {
  if (filter.value === 'all') return posts.value
  return posts.value.filter((p) => p.sourceTenant.type === filter.value)
})

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return

  loadingMore.value = true
  try {
    const response = await ($fetch as any)('/api/operations/news', {
      query: { limit: 10, cursor: nextCursor.value },
      credentials: 'include'
    })

    additionalPosts.value = [...additionalPosts.value, ...response.posts]
    nextCursor.value = response.nextCursor
    hasMore.value = response.hasMore
  } catch (err) {
    console.error('Failed to load more news:', err)
  } finally {
    loadingMore.value = false
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Page meta
useHead({
  title: t('news.allNews')
})
</script>

