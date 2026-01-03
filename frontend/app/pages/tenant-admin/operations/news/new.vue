<template>
  <section class="space-y-6">
    <header>
      <NuxtLink
        to="/tenant-admin/operations/news"
        class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ t('admin.tenantAdmin.operations.backToNews') }}
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
        {{ t('admin.tenantAdmin.operations.createNews') }}
      </h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.tenantAdmin.operations.createNewsDesc') }}
      </p>
    </header>

    <form @submit.prevent="handleSubmit" class="grid gap-6 lg:grid-cols-3">
      <!-- Main content (2 cols) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.newsPostTitle') }} *
          </label>
          <input
            v-model="form.title"
            type="text"
            required
            maxlength="200"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
            :placeholder="t('admin.tenantAdmin.operations.newsPostTitlePlaceholder')"
          />
        </div>

        <!-- Summary -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.summary') }}
          </label>
          <textarea
            v-model="form.summary"
            rows="2"
            maxlength="500"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
            :placeholder="t('admin.tenantAdmin.operations.summaryPlaceholder')"
          />
        </div>

        <!-- Body -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.content') }}
          </label>
          <div class="flex gap-2 mb-2">
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-medium transition"
              :class="previewMode ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' : 'bg-brand text-white'"
              @click="previewMode = false"
            >
              {{ t('admin.tenantAdmin.operations.write') }}
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-medium transition"
              :class="previewMode ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'"
              @click="previewMode = true"
            >
              {{ t('admin.tenantAdmin.operations.preview') }}
            </button>
          </div>
          <textarea
            v-if="!previewMode"
            v-model="form.bodyMarkdown"
            rows="12"
            maxlength="50000"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 font-mono text-sm focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
            :placeholder="t('admin.tenantAdmin.operations.contentPlaceholder')"
          />
          <div
            v-else
            class="w-full min-h-[300px] rounded-lg border border-slate-300 bg-white px-4 py-3 prose prose-sm dark:prose-invert max-w-none dark:border-white/20 dark:bg-slate-800"
            v-html="renderedBody"
          />
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ t('admin.tenantAdmin.operations.markdownSupported') }}
          </p>
        </div>
      </div>

      <!-- Sidebar (1 col) -->
      <div class="space-y-6">
        <!-- Hero Image -->
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {{ t('admin.tenantAdmin.operations.heroImage') }}
          </label>
          <div
            v-if="heroImagePreview"
            class="relative mb-3 h-40 rounded-lg bg-cover bg-center"
            :style="{ backgroundImage: `url(${heroImagePreview})` }"
          >
            <button
              type="button"
              class="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
              @click="removeHeroImage"
            >
              <Icon icon="mdi:close" class="h-4 w-4" />
            </button>
          </div>
          <input
            ref="heroImageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            class="hidden"
            @change="handleHeroImageChange"
          />
          <button
            type="button"
            class="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/20 dark:text-slate-400 dark:hover:bg-white/5"
            @click="($refs.heroImageInput as HTMLInputElement).click()"
          >
            <Icon icon="mdi:image-plus" class="inline h-5 w-5 mr-1" />
            {{ heroImagePreview ? t('admin.tenantAdmin.operations.changeImage') : t('admin.tenantAdmin.operations.uploadImage') }}
          </button>
        </div>

        <!-- Slug -->
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.slug') }}
          </label>
          <input
            v-model="form.slug"
            type="text"
            maxlength="120"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
            :placeholder="t('admin.tenantAdmin.operations.slugPlaceholder')"
          />
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ t('admin.tenantAdmin.operations.slugHint') }}
          </p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="space-y-2">
          <button
            type="submit"
            :disabled="submitting || !form.title.trim()"
            class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
            <Icon v-else icon="mdi:content-save" class="h-4 w-4" />
            {{ t('admin.tenantAdmin.operations.saveDraft') }}
          </button>
          <NuxtLink
            to="/tenant-admin/operations/news"
            class="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {{ t('common.cancel') }}
          </NuxtLink>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { useApiClient } from '~/composables/useApiClient'
import { renderMarkdown } from '~~/shared/markdown'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()
const api = useApiClient()

const currentTenant = computed(() => auth.currentTenant.value)
const tenantId = computed(() => currentTenant.value?.id)

const form = ref({
  title: '',
  slug: '',
  summary: '',
  bodyMarkdown: ''
})

const heroImageFile = ref<File | null>(null)
const heroImagePreview = ref<string | null>(null)
const heroImageInput = ref<HTMLInputElement | null>(null)
const previewMode = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const renderedBody = computed(() => {
  if (!form.value.bodyMarkdown) return '<p class="text-slate-400">No content yet...</p>'
  return renderMarkdown(form.value.bodyMarkdown).html
})

function handleHeroImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    heroImageFile.value = file
    heroImagePreview.value = URL.createObjectURL(file)
  }
}

function removeHeroImage() {
  heroImageFile.value = null
  heroImagePreview.value = null
  if (heroImageInput.value) {
    heroImageInput.value.value = ''
  }
}

async function handleSubmit() {
  if (!tenantId.value || !form.value.title.trim()) return

  submitting.value = true
  error.value = null

  try {
    const payload: Record<string, any> = {
      title: form.value.title.trim(),
      summary: form.value.summary.trim() || null,
      bodyMarkdown: form.value.bodyMarkdown.trim() || null
    }

    if (form.value.slug.trim()) {
      payload.slug = form.value.slug.trim()
    }

    const response = await api<{ post: { id: string } }>(`/api/admin/tenants/${tenantId.value}/news`, {
      method: 'POST',
      body: payload
    })

    // Upload hero image if selected
    if (heroImageFile.value && response.post.id) {
      const formData = new FormData()
      formData.append('heroImage', heroImageFile.value)

      await api(`/api/admin/tenants/${tenantId.value}/news/${response.post.id}/hero-image`, {
        method: 'POST',
        body: formData
      })
    }

    router.push('/tenant-admin/operations/news')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to create news post'
  } finally {
    submitting.value = false
  }
}
</script>

