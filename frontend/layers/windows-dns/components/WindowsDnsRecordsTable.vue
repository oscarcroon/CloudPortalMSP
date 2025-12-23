<template>
  <section class="mod-windows-dns-panel space-y-4">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            DNS Records
          </p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Records for {{ zoneName }}
          </h3>
        </div>
        <div class="relative w-full max-w-xs">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            placeholder="Search records..."
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      </div>
      <div class="flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Showing {{ pagedRecords.length }} of {{ filteredRecords.length }} records
        </p>
        <div v-if="canEdit" class="flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
            @click="showCreateForm = !showCreateForm"
          >
            <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
            {{ showCreateForm ? 'Cancel' : 'Add Record' }}
          </button>
        </div>
      </div>
    </header>

    <!-- Create form -->
    <form
      v-if="canEdit && showCreateForm"
      class="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
      @submit.prevent="createRecord"
    >
      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
          <select v-model="newRecord.type" class="input" required>
            <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
          <input v-model="newRecord.name" class="input" required placeholder="@" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">TTL</label>
          <select v-model.number="newRecord.ttl" class="input">
            <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1 md:col-span-4">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
          <input v-model="newRecord.content" class="input" required placeholder="1.2.3.4" />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn-secondary"
          @click="showCreateForm = false"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="creating"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Add Record
        </button>
      </div>
      <p v-if="createError" class="text-xs text-red-600 dark:text-red-400">{{ createError }}</p>
    </form>

    <!-- Records table -->
    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-800/40">
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <th class="px-4 py-2">Type</th>
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">Content</th>
            <th class="px-4 py-2">TTL</th>
            <th v-if="canEdit" class="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          <tr v-if="pagedRecords.length === 0">
            <td :colspan="canEdit ? 5 : 4" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No records found{{ searchTerm ? ` matching "${searchTerm}"` : '' }}
            </td>
          </tr>
          <template v-for="record in pagedRecords" :key="record.id || record.name + record.type">
            <tr class="text-sm text-slate-700 dark:text-slate-200">
              <td class="px-4 py-3 align-top">
                <span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                  {{ record.type }}
                </span>
              </td>
              <td class="px-4 py-3 align-top font-mono text-sm">{{ record.name || '@' }}</td>
              <td class="px-4 py-3 align-top break-all">{{ record.content || record.value || record.data }}</td>
              <td class="px-4 py-3 align-top">{{ displayTtl(record.ttl) }}</td>
              <td v-if="canEdit" class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
                    type="button"
                    title="Edit"
                    @click="startEdit(record)"
                  >
                    <Icon icon="mdi:pencil" class="h-4 w-4" />
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:border-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 dark:border-red-700 dark:text-red-400"
                    type="button"
                    title="Delete"
                    @click="deleteRecord(record)"
                  >
                    <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
            <!-- Edit row -->
            <tr v-if="editingId === (record.id || record.name + record.type)" class="bg-slate-50/70 dark:bg-slate-800/50">
              <td :colspan="canEdit ? 5 : 4" class="px-4 py-3">
                <form class="grid gap-3" @submit.prevent="updateRecord">
                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
                      <select v-model="editForm.type" class="input" required>
                        <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
                      </select>
                    </div>
                    <div class="flex flex-col gap-1 md:col-span-2">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
                      <input v-model="editForm.name" class="input" required />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">TTL</label>
                      <select v-model.number="editForm.ttl" class="input">
                        <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="flex flex-col gap-1 md:col-span-4">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
                      <input v-model="editForm.content" class="input" required />
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button type="button" class="btn-secondary" @click="cancelEdit">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      :disabled="updating"
                      class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
                    >
                      <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                      Save
                    </button>
                  </div>
                  <p v-if="updateError" class="text-xs text-red-600 dark:text-red-400">{{ updateError }}</p>
                </form>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="recordPageCount > 1"
      class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <span>
        Page {{ currentRecordPage }} of {{ recordPageCount }}
      </span>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100"
          :disabled="currentRecordPage === 1"
          @click="currentRecordPage = Math.max(1, currentRecordPage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="h-4 w-4" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100"
          :disabled="currentRecordPage === recordPageCount"
          @click="currentRecordPage = Math.min(recordPageCount, currentRecordPage + 1)"
        >
          <Icon icon="mdi:chevron-right" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  zoneId: string
  zoneName?: string
  records: any[]
  canEdit: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()

const searchTerm = ref('')
const recordPageSize = 50
const currentRecordPage = ref(1)

const filteredRecords = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return props.records
  return props.records.filter((r) => {
    const hay = `${r.type ?? ''} ${r.name ?? ''} ${r.content ?? ''} ${r.value ?? ''} ${r.data ?? ''}`.toLowerCase()
    return hay.includes(term)
  })
})

const recordPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredRecords.value.length / recordPageSize))
)

const pagedRecords = computed(() => {
  const start = (currentRecordPage.value - 1) * recordPageSize
  return filteredRecords.value.slice(start, start + recordPageSize)
})

watch(
  () => searchTerm.value,
  () => {
    currentRecordPage.value = 1
  }
)

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR', 'SOA']

const ttlOptions = [
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
  { value: 28800, label: '8 hours' },
  { value: 86400, label: '1 day' }
]

const displayTtl = (ttl?: number | null) => {
  if (ttl === null || ttl === undefined) return '-'
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.round(ttl / 60)}m`
  if (ttl < 86400) return `${Math.round(ttl / 3600)}h`
  return `${Math.round(ttl / 86400)}d`
}

// Create form
const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const newRecord = reactive({
  type: 'A',
  name: '@',
  content: '',
  ttl: 3600
})

const createRecord = async () => {
  creating.value = true
  createError.value = null
  try {
    await $fetch(`/api/dns/windows/zones/${props.zoneId}/records`, {
      method: 'POST',
      body: { ...newRecord }
    })
    Object.assign(newRecord, { type: 'A', name: '@', content: '', ttl: 3600 })
    showCreateForm.value = false
    emit('refresh')
  } catch (err: any) {
    createError.value = err?.data?.message ?? err?.message ?? 'Failed to create record'
  } finally {
    creating.value = false
  }
}

// Edit form
const editingId = ref<string | null>(null)
const updating = ref(false)
const updateError = ref<string | null>(null)
const editForm = reactive({
  type: '',
  name: '',
  content: '',
  ttl: 3600,
  originalRecord: null as any
})

const startEdit = (record: any) => {
  editingId.value = record.id || record.name + record.type
  Object.assign(editForm, {
    type: record.type,
    name: record.name || '@',
    content: record.content || record.value || record.data || '',
    ttl: record.ttl ?? 3600,
    originalRecord: record
  })
}

const cancelEdit = () => {
  editingId.value = null
  updateError.value = null
}

const updateRecord = async () => {
  updating.value = true
  updateError.value = null
  try {
    // For Windows DNS, we typically need to delete and recreate
    // The API should handle this internally
    const originalContent = editForm.originalRecord?.content || editForm.originalRecord?.value || editForm.originalRecord?.data || ''
    await $fetch(`/api/dns/windows/zones/${props.zoneId}/records`, {
      method: 'POST',
      body: {
        ...editForm,
        update: true,
        originalName: editForm.originalRecord?.name || '@',
        originalType: editForm.originalRecord?.type,
        originalContent,
        originalRecord: editForm.originalRecord
      }
    })
    cancelEdit()
    emit('refresh')
  } catch (err: any) {
    updateError.value = err?.data?.message ?? err?.message ?? 'Failed to update record'
  } finally {
    updating.value = false
  }
}

const deleteRecord = async (record: any) => {
  if (!confirm(`Delete ${record.type} record for ${record.name || '@'}?`)) return
  try {
    await $fetch(`/api/dns/windows/zones/${props.zoneId}/records`, {
      method: 'DELETE',
      body: {
        name: record.name,
        type: record.type,
        content: record.content || record.value || record.data
      }
    })
    emit('refresh')
  } catch (err: any) {
    console.error('Failed to delete record:', err)
    alert(err?.data?.message ?? err?.message ?? 'Failed to delete record')
  }
}
</script>

<style scoped>
.input {
  @apply rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50;
}
.btn-secondary {
  @apply inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100;
}
.mod-windows-dns-panel {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80;
}
</style>


