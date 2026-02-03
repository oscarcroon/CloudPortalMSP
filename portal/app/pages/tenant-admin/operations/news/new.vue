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

        <!-- Body with Markdown Editor -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.content') }}
          </label>

          <!-- Toolbar -->
          <div class="flex flex-wrap items-center gap-1 mb-2 rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-white/20 dark:bg-slate-800/50">
            <button
              v-for="tool in markdownTools"
              :key="tool.action"
              type="button"
              class="rounded p-1.5 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              :title="tool.label"
              @click="insertMarkdown(tool.action)"
            >
              <Icon :icon="tool.icon" class="h-4 w-4" />
            </button>
            <div class="mx-1 h-5 w-px bg-slate-300 dark:bg-white/20" />
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-medium transition"
              :class="!showPreview ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'"
              @click="showPreview = false"
            >
              <Icon icon="mdi:pencil" class="inline h-3.5 w-3.5 mr-1" />
              {{ t('admin.tenantAdmin.operations.write') }}
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-medium transition"
              :class="showPreview ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'"
              @click="showPreview = true"
            >
              <Icon icon="mdi:eye" class="inline h-3.5 w-3.5 mr-1" />
              {{ t('admin.tenantAdmin.operations.preview') }}
            </button>
            <div class="flex-1" />
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              @click="showMarkdownHelp = !showMarkdownHelp"
            >
              <Icon icon="mdi:help-circle-outline" class="inline h-3.5 w-3.5 mr-1" />
              {{ t('admin.tenantAdmin.operations.markdownHelp') }}
            </button>
          </div>

          <!-- Markdown Help Panel -->
          <div
            v-if="showMarkdownHelp"
            class="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-500/30 dark:bg-blue-500/10"
          >
            <div class="flex items-start justify-between mb-3">
              <h4 class="font-semibold text-blue-900 dark:text-blue-200">
                <Icon icon="mdi:language-markdown" class="inline h-4 w-4 mr-1" />
                {{ t('admin.tenantAdmin.operations.markdownCheatsheet') }}
              </h4>
              <button
                type="button"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                @click="showMarkdownHelp = false"
              >
                <Icon icon="mdi:close" class="h-4 w-4" />
              </button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 text-xs">
              <div class="space-y-1.5">
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">**fetstil**</code> → <strong>fetstil</strong></p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">*kursiv*</code> → <em>kursiv</em></p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded"># Rubrik 1</code></p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">## Rubrik 2</code></p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">### Rubrik 3</code></p>
              </div>
              <div class="space-y-1.5">
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">[länktext](url)</code> → länk</p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">- punkt</code> → punktlista</p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">1. numrerad</code> → numrerad lista</p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">> citat</code> → citatblock</p>
                <p class="text-blue-800 dark:text-blue-300"><code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">`kod`</code> → <code class="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">kod</code></p>
              </div>
            </div>
          </div>

          <!-- Editor / Preview -->
          <div class="relative">
            <textarea
              v-show="!showPreview"
              ref="editorRef"
              v-model="form.bodyMarkdown"
              rows="16"
              maxlength="50000"
              class="w-full rounded-b-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 font-mono text-sm leading-relaxed focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
              :placeholder="t('admin.tenantAdmin.operations.contentPlaceholder')"
              @keydown="handleEditorKeydown"
            />
            <div
              v-show="showPreview"
              class="markdown-preview w-full min-h-[400px] rounded-b-lg border border-slate-300 bg-white px-4 py-3 prose prose-sm dark:prose-invert max-w-none dark:border-white/20 dark:bg-slate-800 overflow-auto"
              v-html="renderedBody"
            />
          </div>

          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <Icon icon="mdi:keyboard" class="inline h-3.5 w-3.5 mr-1" />
            {{ t('admin.tenantAdmin.operations.keyboardShortcuts') }}
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
import { ref, computed, nextTick } from 'vue'
import { useI18n, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { renderMarkdown } from '~~/shared/markdown'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()

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
const editorRef = ref<HTMLTextAreaElement | null>(null)
const showPreview = ref(false)
const showMarkdownHelp = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const renderedBody = computed(() => {
  if (!form.value.bodyMarkdown) return '<p class="text-slate-400 italic">Ingen förhandsgranskning tillgänglig...</p>'
  return renderMarkdown(form.value.bodyMarkdown).html
})

// Markdown toolbar tools
const markdownTools = computed(() => [
  { action: 'bold', icon: 'mdi:format-bold', label: t('admin.tenantAdmin.operations.toolbar.bold') },
  { action: 'italic', icon: 'mdi:format-italic', label: t('admin.tenantAdmin.operations.toolbar.italic') },
  { action: 'h1', icon: 'mdi:format-header-1', label: t('admin.tenantAdmin.operations.toolbar.heading1') },
  { action: 'h2', icon: 'mdi:format-header-2', label: t('admin.tenantAdmin.operations.toolbar.heading2') },
  { action: 'h3', icon: 'mdi:format-header-3', label: t('admin.tenantAdmin.operations.toolbar.heading3') },
  { action: 'link', icon: 'mdi:link', label: t('admin.tenantAdmin.operations.toolbar.link') },
  { action: 'ul', icon: 'mdi:format-list-bulleted', label: t('admin.tenantAdmin.operations.toolbar.bulletList') },
  { action: 'ol', icon: 'mdi:format-list-numbered', label: t('admin.tenantAdmin.operations.toolbar.numberedList') },
  { action: 'quote', icon: 'mdi:format-quote-close', label: t('admin.tenantAdmin.operations.toolbar.quote') },
  { action: 'code', icon: 'mdi:code-tags', label: t('admin.tenantAdmin.operations.toolbar.code') }
])

function insertMarkdown(action: string) {
  const textarea = editorRef.value
  if (!textarea) return

  // Ensure we get the latest selection from the actual textarea element
  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const text = textarea.value // Use textarea.value directly for accuracy
  const selectedText = text.substring(start, end)
  const hasSelection = selectedText.length > 0

  let before = ''
  let after = ''
  let placeholder = ''
  let selectStart = 0
  let selectEnd = 0

  switch (action) {
    case 'bold':
      before = '**'
      after = '**'
      placeholder = 'fetstil'
      break
    case 'italic':
      before = '*'
      after = '*'
      placeholder = 'kursiv'
      break
    case 'h1':
      before = '# '
      after = ''
      placeholder = 'Rubrik 1'
      break
    case 'h2':
      before = '## '
      after = ''
      placeholder = 'Rubrik 2'
      break
    case 'h3':
      before = '### '
      after = ''
      placeholder = 'Rubrik 3'
      break
    case 'link':
      if (hasSelection) {
        before = '['
        after = '](url)'
      } else {
        before = '['
        after = '](url)'
        placeholder = 'länktext'
      }
      break
    case 'ul':
      before = '- '
      after = ''
      placeholder = 'listpunkt'
      break
    case 'ol':
      before = '1. '
      after = ''
      placeholder = 'listpunkt'
      break
    case 'quote':
      before = '> '
      after = ''
      placeholder = 'citat'
      break
    case 'code':
      before = '`'
      after = '`'
      placeholder = 'kod'
      break
  }

  const insertedText = hasSelection ? selectedText : placeholder
  const newText = text.substring(0, start) + before + insertedText + after + text.substring(end)

  // Update both the textarea value and Vue's reactive state
  form.value.bodyMarkdown = newText

  // Calculate cursor/selection position
  if (hasSelection) {
    // Place cursor after the inserted formatted text
    selectStart = start + before.length + insertedText.length + after.length
    selectEnd = selectStart
  } else {
    // Select the placeholder text so user can type over it
    selectStart = start + before.length
    selectEnd = selectStart + placeholder.length
  }

  // Restore focus and selection
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(selectStart, selectEnd)
  })
}

function handleEditorKeydown(event: KeyboardEvent) {
  // Keyboard shortcuts: Ctrl/Cmd + B for bold, Ctrl/Cmd + I for italic
  if (event.ctrlKey || event.metaKey) {
    switch (event.key.toLowerCase()) {
      case 'b':
        event.preventDefault()
        insertMarkdown('bold')
        break
      case 'i':
        event.preventDefault()
        insertMarkdown('italic')
        break
      case 'k':
        event.preventDefault()
        insertMarkdown('link')
        break
    }
  }
}

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

    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/news`, {
      method: 'POST',
      body: payload,
      credentials: 'include'
    })

    // Upload hero image if selected
    if (heroImageFile.value && response.id) {
      const formData = new FormData()
      formData.append('heroImage', heroImageFile.value)

      await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/news/${response.id}/hero-image`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
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

<style scoped>
.markdown-preview :deep(code) {
  background-color: rgb(241 245 249); /* slate-100 */
  color: rgb(220 38 38); /* red-600 */
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.dark .markdown-preview :deep(code) {
  background-color: rgb(30 41 59); /* slate-800 */
  color: rgb(248 113 113); /* red-400 */
}

.markdown-preview :deep(pre) {
  background-color: rgb(30 41 59); /* slate-800 */
  color: rgb(226 232 240); /* slate-200 */
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

.markdown-preview :deep(pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
  font-size: 0.875rem;
}

.markdown-preview :deep(blockquote) {
  border-left: 4px solid rgb(59 130 246); /* blue-500 */
  background-color: rgb(239 246 255); /* blue-50 */
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 0 0.375rem 0.375rem 0;
  color: rgb(30 64 175); /* blue-800 */
  font-style: italic;
}

.dark .markdown-preview :deep(blockquote) {
  border-left-color: rgb(96 165 250); /* blue-400 */
  background-color: rgb(30 58 138 / 0.2); /* blue-900/20 */
  color: rgb(191 219 254); /* blue-200 */
}

.markdown-preview :deep(blockquote p) {
  margin: 0;
}
</style>
