<template>
  <section class="mx-auto max-w-5xl space-y-8">
    <!-- Top nav -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400 dark:hover:text-brand"
      >
        <Icon icon="heroicons:arrow-left" class="h-4 w-4" />
        {{ t('news.backToDashboard') }}
      </NuxtLink>
      <NuxtLink
        to="/news"
        class="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
      >
        {{ t('news.allNews') }}
        <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
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
      <p class="mt-4 text-red-700 dark:text-red-300">{{ t('news.notFound') }}</p>
      <NuxtLink to="/news" class="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        {{ t('news.allNews') }}
        <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
      </NuxtLink>
    </div>

    <!-- News content -->
    <div v-else-if="post" class="space-y-8">
      <!-- Hero -->
      <header class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="relative">
          <!-- With hero image: keep the large visual header -->
          <template v-if="post.heroImageUrl">
            <div class="aspect-[16/7] w-full bg-slate-100 dark:bg-slate-800">
              <img :src="post.heroImageUrl" :alt="post.title" class="h-full w-full object-cover" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"></div>

            <div class="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <div class="flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span
                  :class="[
                    'rounded-full px-2.5 py-1 font-medium',
                    post.sourceTenant.type === 'distributor'
                      ? 'bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/30'
                      : 'bg-blue-500/20 text-blue-100 ring-1 ring-blue-400/30'
                  ]"
                >
                  {{ post.sourceTenant.type === 'distributor' ? t('news.distributor') : t('news.provider') }}
                </span>
                <span class="text-white/70">{{ post.sourceTenant.name }}</span>
                <span class="text-white/40">•</span>
                <span class="text-white/70">{{ formatDate(post.publishedAt) }}</span>
              </div>

              <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {{ post.title }}
              </h1>
              <p v-if="post.summary" class="mt-3 max-w-3xl text-base text-white/80 sm:text-lg">
                {{ post.summary }}
              </p>
            </div>
          </template>

          <!-- No hero image: compact header with a nice gradient/pattern (less height) -->
          <div
            v-else
            class="relative overflow-hidden bg-gradient-to-br from-brand/5 via-slate-50 to-slate-200 px-6 py-8 dark:from-brand/10 dark:via-slate-900 dark:to-slate-950 sm:px-10 sm:py-10"
          >
            <!-- Combined design: Glow blobs + Rotated grid -->
            <div class="pointer-events-none absolute inset-0 overflow-hidden">
              <!-- Glow blobs -->
              <div class="absolute -left-[10%] -top-[20%] h-[150%] w-[50%] rounded-full bg-brand/10 blur-[120px] dark:bg-brand/20"></div>
              <div class="absolute -right-[10%] -bottom-[20%] h-[120%] w-[40%] rounded-full bg-slate-400/10 blur-[100px] dark:bg-brand/10"></div>
              
              <!-- Rotated dual-grid pattern -->
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
              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span
                  :class="[
                    'rounded-full px-2.5 py-1 font-medium ring-1',
                    post.sourceTenant.type === 'distributor'
                      ? 'bg-purple-500/10 text-purple-700 ring-purple-500/20 dark:bg-purple-500/15 dark:text-purple-200 dark:ring-purple-400/20'
                      : 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20'
                  ]"
                >
                  {{ post.sourceTenant.type === 'distributor' ? t('news.distributor') : t('news.provider') }}
                </span>
                <span>{{ post.sourceTenant.name }}</span>
                <span class="text-slate-400 dark:text-slate-500">•</span>
                <span class="text-slate-500 dark:text-slate-400">{{ formatDate(post.publishedAt) }}</span>
              </div>

              <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {{ post.title }}
              </h1>
              <p v-if="post.summary" class="mt-3 max-w-3xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
                {{ post.summary }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <!-- Body -->
      <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70 sm:p-10">
        <div
          v-if="post.bodyMarkdown"
          class="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-brand prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold prose-code:text-sm prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-blockquote:border-l-brand prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:text-blue-900 dark:prose-blockquote:text-blue-200 prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
          v-html="renderedBody"
        ></div>
      </article>

      <!-- Prev/Next navigation -->
      <div v-if="navigation.previous || navigation.next" class="grid gap-4 sm:grid-cols-2">
        <NuxtLink
          v-if="navigation.previous"
          :to="`/news/${navigation.previous.slug}`"
          class="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-brand/50"
        >
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon icon="heroicons:arrow-left" class="h-4 w-4" />
            {{ t('news.previous') }}
          </div>
          <div class="mt-2 line-clamp-2 font-medium text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
            {{ navigation.previous.title }}
          </div>
        </NuxtLink>

        <NuxtLink
          v-if="navigation.next"
          :to="`/news/${navigation.next.slug}`"
          class="group rounded-2xl border border-slate-200 bg-white p-5 text-right transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-brand/50"
        >
          <div class="flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
            {{ t('news.next') }}
            <Icon icon="heroicons:arrow-right" class="h-4 w-4" />
          </div>
          <div class="mt-2 line-clamp-2 font-medium text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
            {{ navigation.next.title }}
          </div>
        </NuxtLink>
      </div>

      <!-- More news section -->
      <section v-if="otherNews.length > 0" class="border-t border-slate-200 pt-8 dark:border-slate-700">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            {{ t('news.moreNews') }}
          </h2>
          <NuxtLink to="/news" class="text-sm text-brand hover:underline">
            {{ t('news.viewAll') }}
          </NuxtLink>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="newsItem in otherNews"
            :key="newsItem.id"
            :to="`/news/${newsItem.slug}`"
            class="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-brand/30 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-brand/50"
          >
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{{ newsItem.sourceTenant.name }}</span>
              <span>•</span>
              <span>{{ formatShortDate(newsItem.publishedAt) }}</span>
            </div>
            <h3 class="mt-2 line-clamp-2 font-medium text-slate-900 group-hover:text-brand dark:text-white dark:group-hover:text-brand">
              {{ newsItem.title }}
            </h3>
          </NuxtLink>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { renderMarkdown } from '~~/shared/markdown'

interface NewsPost {
  id: string
  title: string
  slug: string
  summary: string | null
  heroImageUrl: string | null
  bodyMarkdown: string | null
  publishedAt: string | null
  createdAt: string
  sourceTenant: {
    id: string
    name: string
    type: 'provider' | 'distributor' | 'organization'
  }
}

interface NewsListItem {
  id: string
  title: string
  slug: string
  summary: string | null
  publishedAt: string | null
  sourceTenant: {
    id: string
    name: string
    type: 'provider' | 'distributor' | 'organization'
  }
}

interface NewsResponse {
  post: NewsPost
  navigation: {
    previous: { title: string; slug: string } | null
    next: { title: string; slug: string } | null
  }
}

interface NewsListResponse {
  posts: NewsListItem[]
}

const { t } = useI18n()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const { data, pending, error } = await useFetch<NewsResponse>(
  () => `/api/operations/news/${slug.value}`,
  {
    credentials: 'include'
  }
)

const post = computed(() => data.value?.post ?? null)
const navigation = computed(() => data.value?.navigation ?? { previous: null, next: null })

// Fetch other news for the "More news" section
const { data: newsListData } = await useFetch<NewsListResponse>(
  '/api/operations/news',
  {
    query: { limit: 4 },
    credentials: 'include'
  }
)

// Filter out current post and limit to 3
const otherNews = computed(() => {
  const all = newsListData.value?.posts ?? []
  return all.filter((n) => n.slug !== slug.value).slice(0, 3)
})

const renderedBody = computed(() => {
  if (!post.value?.bodyMarkdown) return ''
  return renderMarkdown(post.value.bodyMarkdown).html
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('sv-SE', {
    month: 'short',
    day: 'numeric'
  })
}

// Page meta
useHead({
  title: computed(() => post.value?.title ?? t('news.title'))
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
