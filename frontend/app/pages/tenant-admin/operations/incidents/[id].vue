<template>
  <section class="space-y-6">
    <header>
      <NuxtLink
        to="/tenant-admin/operations/incidents"
        class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ t('admin.tenantAdmin.operations.backToIncidents') }}
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
        {{ t('admin.tenantAdmin.operations.editIncident') }}
      </h1>
    </header>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-12">
      <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
    </div>

    <form v-else-if="incident" @submit.prevent="handleSubmit" class="max-w-2xl space-y-6">
      <!-- Status badge -->
      <div class="flex items-center gap-3">
        <span
          v-if="incident.status === 'active'"
          class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
        >
          <Icon icon="mdi:circle" class="h-2 w-2" />
          {{ t('admin.tenantAdmin.operations.status.active') }}
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
        >
          <Icon icon="mdi:check-circle" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.resolved') }}
        </span>
        <button
          v-if="incident.status === 'active'"
          type="button"
          :disabled="statusChanging"
          class="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-600 bg-transparent px-3 py-1.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-500/10"
          @click="resolveIncident"
        >
          <Icon v-if="statusChanging" icon="mdi:loading" class="h-4 w-4 animate-spin" />
          <Icon v-else icon="mdi:check-circle" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.markResolved') }}
        </button>
        <button
          v-else
          type="button"
          :disabled="statusChanging"
          class="inline-flex items-center gap-1.5 rounded-lg border-2 border-amber-600 bg-transparent px-3 py-1.5 text-sm font-medium text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500 dark:text-amber-500 dark:hover:bg-amber-500/10"
          @click="reactivateIncident"
        >
          <Icon v-if="statusChanging" icon="mdi:loading" class="h-4 w-4 animate-spin" />
          <Icon v-else icon="mdi:refresh" class="h-4 w-4" />
          {{ t('admin.tenantAdmin.operations.reactivate') }}
        </button>
      </div>

      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.incidentTitle') }} *
        </label>
        <input
          v-model="form.title"
          type="text"
          required
          maxlength="200"
          class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <!-- Severity -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.severity') }}
        </label>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <button
            v-for="sev in severityOptions"
            :key="sev.value"
            type="button"
            class="rounded-lg border px-3 py-2 text-sm font-medium transition"
            :class="form.severity === sev.value ? sev.activeClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'"
            @click="form.severity = sev.value"
          >
            <Icon :icon="sev.icon" class="inline h-4 w-4 mr-1" />
            {{ sev.label }}
          </button>
        </div>
      </div>

      <!-- Time window -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.startsAt') }}
          </label>
          <input
            v-model="form.startsAt"
            type="datetime-local"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {{ t('admin.tenantAdmin.operations.endsAt') }}
          </label>
          <input
            v-model="form.endsAt"
            type="datetime-local"
            class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <!-- Body with Markdown Editor -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ t('admin.tenantAdmin.operations.description') }}
        </label>

        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-1 mb-0 rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 px-2 py-1.5 dark:border-white/20 dark:bg-slate-800/50">
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
          class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-500/30 dark:bg-blue-500/10"
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
            rows="8"
            maxlength="10000"
            class="w-full rounded-b-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 font-mono text-sm leading-relaxed focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-800 dark:text-slate-100"
            :class="{ 'rounded-t-none': !showMarkdownHelp }"
            @keydown="handleEditorKeydown"
          />
          <div
            v-show="showPreview"
            class="markdown-preview w-full min-h-[200px] rounded-b-lg border border-slate-300 bg-white px-4 py-3 prose prose-sm dark:prose-invert max-w-none dark:border-white/20 dark:bg-slate-800 overflow-auto"
            v-html="renderedBody"
          />
        </div>

        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon icon="mdi:keyboard" class="inline h-3.5 w-3.5 mr-1" />
          {{ t('admin.tenantAdmin.operations.keyboardShortcuts') }}
        </p>
      </div>

      <!-- Error message -->
      <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
        {{ error }}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="submitting || !form.title.trim()"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
          <Icon v-else icon="mdi:check" class="h-4 w-4" />
          {{ t('common.save') }}
        </button>
        <NuxtLink
          to="/tenant-admin/operations/incidents"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {{ t('common.cancel') }}
        </NuxtLink>
      </div>
    </form>

    <!-- Not found -->
    <div v-else class="text-center py-12">
      <p class="text-slate-500 dark:text-slate-400">{{ t('admin.tenantAdmin.operations.incidentNotFound') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n, useRoute, useFetch, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { renderMarkdown } from '~~/shared/markdown'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuth()

const incidentId = computed(() => route.params.id as string)
const currentTenant = computed(() => auth.currentTenant.value)
const tenantId = computed(() => currentTenant.value?.id)

interface IncidentDetail {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved'
  startsAt: string | null
  endsAt: string | null
}

const { data, pending, refresh } = useFetch<{ incident: IncidentDetail }>(
  () => tenantId.value ? `/api/admin/tenants/${tenantId.value}/incidents?filter=all` : '',
  {
    immediate: !!tenantId.value,
    watch: [tenantId],
    transform: (response: { incidents: IncidentDetail[] }) => {
      const found = response.incidents.find(i => i.id === incidentId.value)
      return { incident: found }
    }
  }
)

const incident = computed(() => data.value?.incident)

const form = ref({
  title: '',
  severity: 'notice' as 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned',
  bodyMarkdown: '',
  startsAt: '',
  endsAt: ''
})

const editorRef = ref<HTMLTextAreaElement | null>(null)
const showPreview = ref(false)
const showMarkdownHelp = ref(false)
const submitting = ref(false)
const statusChanging = ref(false)
const error = ref<string | null>(null)

const renderedBody = computed(() => {
  if (!form.value.bodyMarkdown) return '<p class="text-slate-400 italic">Ingen förhandsgranskning tillgänglig...</p>'
  return renderMarkdown(form.value.bodyMarkdown).html
})

// Populate form when incident loads
watch(incident, (inc) => {
  if (inc) {
    form.value.title = inc.title
    form.value.severity = inc.severity
    form.value.bodyMarkdown = inc.bodyMarkdown || ''
    form.value.startsAt = inc.startsAt ? toDateTimeLocal(inc.startsAt) : ''
    form.value.endsAt = inc.endsAt ? toDateTimeLocal(inc.endsAt) : ''
  }
}, { immediate: true })

function toDateTimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const severityOptions = [
  { value: 'critical' as const, label: t('operations.severity.critical'), icon: 'mdi:alert-circle', activeClass: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-300' },
  { value: 'outage' as const, label: t('operations.severity.outage'), icon: 'mdi:alert', activeClass: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/20 dark:text-orange-300' },
  { value: 'maintenance' as const, label: t('operations.severity.maintenance'), icon: 'mdi:wrench', activeClass: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/20 dark:text-sky-300' },
  { value: 'planned' as const, label: t('operations.severity.planned'), icon: 'mdi:calendar-clock', activeClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-300' },
  { value: 'notice' as const, label: t('operations.severity.notice'), icon: 'mdi:information', activeClass: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300' }
]

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

  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0
  const text = textarea.value
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

  form.value.bodyMarkdown = newText

  if (hasSelection) {
    selectStart = start + before.length + insertedText.length + after.length
    selectEnd = selectStart
  } else {
    selectStart = start + before.length
    selectEnd = selectStart + placeholder.length
  }

  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(selectStart, selectEnd)
  })
}

function handleEditorKeydown(event: KeyboardEvent) {
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

async function handleSubmit() {
  if (!tenantId.value || !incidentId.value || !form.value.title.trim()) return

  submitting.value = true
  error.value = null

  try {
    const payload: Record<string, any> = {
      title: form.value.title.trim(),
      severity: form.value.severity,
      bodyMarkdown: form.value.bodyMarkdown.trim() || null
    }

    if (form.value.startsAt) {
      payload.startsAt = new Date(form.value.startsAt).toISOString()
    } else {
      payload.startsAt = null
    }
    if (form.value.endsAt) {
      payload.endsAt = new Date(form.value.endsAt).toISOString()
    } else {
      payload.endsAt = null
    }

    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId.value}`, {
      method: 'PUT',
      body: payload,
      credentials: 'include'
    })

    router.push('/tenant-admin/operations/incidents')
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to update incident'
  } finally {
    submitting.value = false
  }
}

async function resolveIncident() {
  if (!tenantId.value || !incidentId.value) return
  statusChanging.value = true
  error.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId.value}/resolve`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to resolve incident'
  } finally {
    statusChanging.value = false
  }
}

async function reactivateIncident() {
  if (!tenantId.value || !incidentId.value) return
  statusChanging.value = true
  error.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/incidents/${incidentId.value}/reactivate`, {
      method: 'POST',
      credentials: 'include'
    })
    await refresh()
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to reactivate incident'
  } finally {
    statusChanging.value = false
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
