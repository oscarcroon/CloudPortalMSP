<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">DNS records</p>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">Records</h3>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <div class="relative w-full max-w-xs">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            placeholder="Sök records (typ, namn, content)…"
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
        <div v-if="canEdit" class="text-xs text-slate-500 dark:text-slate-400">CRUD aktiverat</div>
      </div>
    </header>

    <form v-if="canEdit" class="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" @submit.prevent="createRecord">
      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
          <select v-model="newRecord.type" class="input" required>
            <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ typeHelp(newRecord.type) }}</p>
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
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Kommentar (valfri)</label>
          <input v-model="newRecord.comment" class="input" placeholder="Notering om recordet" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proxied</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
              :class="
                proxiedString === 'true'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-100'
              "
              @click="proxiedString = proxiedString === 'true' ? '' : 'true'"
              title="Proxied = trafik via Cloudflare CDN/edge"
            >
              <Icon icon="mdi:cloud-check-outline" class="h-4 w-4" />
              Proxied
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
              :class="
                proxiedString === 'false'
                  ? 'border-slate-400 text-slate-700 dark:border-slate-600 dark:text-slate-100'
                  : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-100'
              "
              @click="proxiedString = proxiedString === 'false' ? '' : 'false'"
              title="DNS only = ingen proxning genom Cloudflare"
            >
              <Icon icon="mdi:server" class="h-4 w-4" />
              DNS only
            </button>
          </div>
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
          <template v-for="record in filteredRecords" :key="record.id">
          <tr class="text-sm text-slate-700 dark:text-slate-200">
            <td class="px-4 py-3 align-top">{{ record.type }}</td>
            <td class="px-4 py-3 align-top">
              <div class="flex items-center gap-1">
                <span>{{ record.name }}</span>
                <span
                  v-if="record.comment"
                  class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  :title="record.comment"
                >
                  <Icon icon="mdi:comment-text-outline" class="h-3 w-3" />
                </span>
              </div>
            </td>
            <td class="px-4 py-3 align-top break-all">{{ record.content }}</td>
            <td class="px-4 py-3 align-top">{{ displayTtl(record.ttl) }}</td>
              <td class="px-4 py-3 align-top">
              <span
                v-if="record.proxied === true"
                class="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand"
                title="Proxied via Cloudflare"
              >
                <Icon icon="mdi:cloud-check-outline" class="h-3 w-3" /> Proxied
              </span>
              <span
                v-else-if="record.proxied === false"
                class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                title="Endast DNS"
              >
                <Icon icon="mdi:server" class="h-3 w-3" /> DNS only
              </span>
              <span v-else class="text-xs text-slate-400">-</span>
              </td>
              <td v-if="canEdit" class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
                    type="button"
                    title="Redigera"
                    @click="startEdit(record)"
                  >
                    <Icon icon="mdi:pencil" class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="editingId === record.id" class="bg-slate-50/70 dark:bg-slate-800/50">
              <td :colspan="canEdit ? 6 : 5" class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 grid gap-3 md:grid-cols-4">
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Type</label>
                      <select v-model="editForm.type" class="input" required>
                        <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ typeHelp(editForm.type) }}</p>
                    </div>
                    <div class="flex flex-col gap-1 md:col-span-2">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
                      <input v-model="editForm.name" class="input" required />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">TTL</label>
                      <input v-model.number="editForm.ttl" class="input" type="number" min="0" placeholder="300 (1=auto)" />
                    </div>
                    <div class="flex flex-col gap-1 md:col-span-3">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
                      <input v-model="editForm.content" class="input" required />
                    </div>
                    <div class="flex flex-col gap-1 md:col-span-3">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Kommentar (valfri)</label>
                      <input v-model="editForm.comment" class="input" placeholder="Notering om recordet" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proxied</label>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
                          :class="
                            editProxiedString === 'true'
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-100'
                          "
                          @click="editProxiedString = editProxiedString === 'true' ? '' : 'true'"
                          title="Proxied = trafik via Cloudflare CDN/edge"
                        >
                          <Icon icon="mdi:cloud-check-outline" class="h-4 w-4" />
                          Proxied
                        </button>
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
                          :class="
                            editProxiedString === 'false'
                              ? 'border-slate-400 text-slate-700 dark:border-slate-600 dark:text-slate-100'
                              : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-100'
                          "
                          @click="editProxiedString = editProxiedString === 'false' ? '' : 'false'"
                          title="DNS only = ingen proxning genom Cloudflare"
                        >
                          <Icon icon="mdi:server" class="h-4 w-4" />
                          DNS only
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <button
                      class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
                      type="button"
                      :disabled="updating"
                      @click="updateRecord"
                    >
                      <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                      Spara
                    </button>
                    <button class="btn-secondary" type="button" @click="cancelEdit">Avbryt</button>
                    <button class="btn-danger" type="button" @click="deleteRecord(record.id)">Ta bort</button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
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

const searchTerm = ref('')

const filteredRecords = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return props.records
  return props.records.filter((r) => {
    const hay = `${r.type ?? ''} ${r.name ?? ''} ${r.content ?? ''} ${r.comment ?? ''}`.toLowerCase()
    return hay.includes(term)
  })
})

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA', 'PTR', 'SPF', 'SOA', 'HTTPS', 'SVCB']

const typeHelp = (type: string) => {
  switch (type) {
    case 'A':
      return 'IPv4-adress (t.ex. 1.2.3.4)'
    case 'AAAA':
      return 'IPv6-adress'
    case 'CNAME':
      return 'Alias till annat namn'
    case 'MX':
      return 'Mailserver (content = host, name = subdomän)'
    case 'TXT':
      return 'Textrecord, t.ex. SPF/DKIM'
    case 'SRV':
      return 'Tjänst (prio/weight/port/target)'
    case 'CAA':
      return 'Vilka CA får utfärda cert'
    case 'NS':
      return 'Nameserver (delegering)'
    default:
      return 'Standardinställning'
  }
}

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

const displayTtl = (ttl?: number | null) => {
  if (ttl === null || ttl === undefined) return 'auto'
  if (ttl === 1) return 'auto'
  return ttl
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


