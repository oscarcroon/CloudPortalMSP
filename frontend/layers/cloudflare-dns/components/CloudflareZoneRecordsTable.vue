<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">DNS records</p>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">Records</h3>
      </div>
      <div v-if="canEdit" class="text-xs text-slate-500 dark:text-slate-400">CRUD aktiverat</div>
    </header>

    <form v-if="canEdit" class="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" @submit.prevent="createRecord">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
          <input v-model="newRecord.type" class="input" required placeholder="A" />
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
          <input v-model="newRecord.name" class="input" required placeholder="www" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">TTL</label>
          <input v-model.number="newRecord.ttl" class="input" type="number" min="0" placeholder="300" />
        </div>
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
          <input v-model="newRecord.content" class="input" required placeholder="1.2.3.4" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proxied</label>
          <select v-model="proxiedString" class="input">
            <option :value="''">Ingen</option>
            <option :value="'true'">True</option>
            <option :value="'false'">False</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="creating"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Lägg till record
        </button>
      </div>
    </form>

    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-800/40">
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <th class="px-4 py-2">Type</th>
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">Content</th>
            <th class="px-4 py-2">TTL</th>
            <th class="px-4 py-2">Proxied</th>
            <th v-if="canEdit" class="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          <tr v-for="record in records" :key="record.id" class="text-sm text-slate-700 dark:text-slate-200">
            <td class="px-4 py-3 align-top">{{ record.type }}</td>
            <td class="px-4 py-3 align-top">{{ record.name }}</td>
            <td class="px-4 py-3 align-top break-all">{{ record.content }}</td>
            <td class="px-4 py-3 align-top">{{ record.ttl ?? 'auto' }}</td>
            <td class="px-4 py-3 align-top">
              <span v-if="record.proxied === true" class="text-xs font-semibold text-brand">True</span>
              <span v-else-if="record.proxied === false" class="text-xs text-slate-500">False</span>
              <span v-else class="text-xs text-slate-400">-</span>
            </td>
            <td v-if="canEdit" class="px-4 py-3 text-right">
              <div class="flex justify-end gap-2">
                <button class="btn-secondary" type="button" @click="startEdit(record)">Redigera</button>
                <button class="btn-danger" type="button" @click="deleteRecord(record.id)">Ta bort</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editing" class="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <header class="mb-3 flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Redigera record</p>
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ editForm.name }}</p>
        </div>
        <button class="btn-secondary" type="button" @click="cancelEdit">Avbryt</button>
      </header>
      <form class="grid gap-3 md:grid-cols-4" @submit.prevent="updateRecord">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
          <input v-model="editForm.type" class="input" required />
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
          <input v-model="editForm.name" class="input" required />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">TTL</label>
          <input v-model.number="editForm.ttl" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
          <input v-model="editForm.content" class="input" required />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proxied</label>
          <select v-model="editProxiedString" class="input">
            <option :value="''">Ingen</option>
            <option :value="'true'">True</option>
            <option :value="'false'">False</option>
          </select>
        </div>
        <div class="md:col-span-4 flex justify-end">
          <button
            type="submit"
            :disabled="updating"
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
          >
            <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
            Spara ändring
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  zoneId: string
  records: any[]
  canEdit: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()

const newRecord = reactive({
  type: 'A',
  name: '',
  content: '',
  ttl: 300,
  proxied: null as boolean | null
})

const proxiedString = computed({
  get: () => (newRecord.proxied === null ? '' : String(newRecord.proxied)),
  set: (value: string) => {
    if (value === '') newRecord.proxied = null
    else newRecord.proxied = value === 'true'
  }
})

const creating = ref(false)

const createRecord = async () => {
  creating.value = true
  try {
    await $fetch(`/api/dns/cloudflare/zones/${props.zoneId}/records`, {
      method: 'POST',
      body: {
        ...newRecord
      }
    })
    Object.assign(newRecord, { type: 'A', name: '', content: '', ttl: 300, proxied: null })
    emit('refresh')
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte skapa record', error)
  } finally {
    creating.value = false
  }
}

const editing = ref(false)
const updating = ref(false)
const editingId = ref<string | null>(null)
const editForm = reactive({
  type: '',
  name: '',
  content: '',
  ttl: 300,
  proxied: null as boolean | null
})

const editProxiedString = computed({
  get: () => (editForm.proxied === null ? '' : String(editForm.proxied)),
  set: (value: string) => {
    if (value === '') editForm.proxied = null
    else editForm.proxied = value === 'true'
  }
})

const startEdit = (record: any) => {
  editingId.value = record.id
  Object.assign(editForm, {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl ?? 300,
    proxied: record.proxied ?? null
  })
  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
  editingId.value = null
}

const updateRecord = async () => {
  if (!editingId.value) return
  updating.value = true
  try {
    await $fetch(`/api/dns/cloudflare/zones/${props.zoneId}/records/${editingId.value}`, {
      method: 'PATCH',
      body: {
        ...editForm
      }
    })
    emit('refresh')
    cancelEdit()
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte uppdatera record', error)
  } finally {
    updating.value = false
  }
}

const deleteRecord = async (recordId: string) => {
  if (!confirm('Ta bort record?')) return
  try {
    await $fetch(`/api/dns/cloudflare/zones/${props.zoneId}/records/${recordId}`, {
      method: 'DELETE'
    })
    emit('refresh')
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte ta bort record', error)
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
.btn-danger {
  @apply inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 dark:border-red-700 dark:text-red-400;
}
</style>


