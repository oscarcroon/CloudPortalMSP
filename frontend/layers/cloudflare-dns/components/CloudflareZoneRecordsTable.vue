<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">DNS records</p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">Records</h3>
        </div>
        <div class="relative w-full max-w-xs">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            placeholder="Sök records (typ, namn, content)…"
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      </div>
      <div v-if="canEdit" class="flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
          @click="showCreateForm = !showCreateForm"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          {{ showCreateForm ? 'Dölj formulär' : 'Lägg till record' }}
        </button>
      </div>
    </header>

    <form
      v-if="canEdit && showCreateForm"
      class="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
      @submit.prevent="createRecord"
    >
      <div
        class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
      >
        <p class="font-semibold">Preview</p>
        <p class="mt-1 break-all text-base font-medium text-slate-800 dark:text-slate-100">
          {{ previewLine(newRecord) }}
        </p>
      </div>

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
          <select v-model.number="newRecord.ttl" class="input">
            <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
      <div v-if="shouldShowContent(newRecord.type)" class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
          <input v-model="newRecord.content" class="input" required placeholder="1.2.3.4" />
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

      <!-- Type-specifika fält (create) -->
      <div v-if="newRecord.type === 'MX'" class="grid gap-3 md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">MX priority</label>
          <input v-model.number="newExtras.mxPriority" class="input" type="number" min="0" placeholder="10" />
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">MX host (content)</label>
          <input v-model="newExtras.mxTarget" class="input" placeholder="mail.example.com" />
        </div>
      </div>

      <div v-if="newRecord.type === 'CAA'" class="grid gap-3 md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Flag</label>
          <input v-model.number="newExtras.caaFlag" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Tag</label>
          <select v-model="newExtras.caaTag" class="input">
            <option value="issue">issue</option>
            <option value="issuewild">issuewild</option>
            <option value="iodef">iodef</option>
          </select>
        </div>
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Value</label>
          <input v-model="newExtras.caaValue" class="input" placeholder="letsencrypt.org" />
        </div>
      </div>

      <div v-if="newRecord.type === 'SRV'" class="grid gap-3 md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Service (_sip)</label>
          <input v-model="newExtras.srvService" class="input" placeholder="_sip" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proto (_tcp/_udp)</label>
          <input v-model="newExtras.srvProto" class="input" placeholder="_tcp" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Priority</label>
          <input v-model.number="newExtras.srvPriority" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Weight</label>
          <input v-model.number="newExtras.srvWeight" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Port</label>
          <input v-model.number="newExtras.srvPort" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Target</label>
          <input v-model="newExtras.srvTarget" class="input" placeholder="target.example.com" />
        </div>
      </div>

      <div v-if="newRecord.type === 'HTTPS' || newRecord.type === 'SVCB'" class="grid gap-3 md:grid-cols-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Priority</label>
          <input v-model.number="newExtras.svcbPriority" class="input" type="number" min="0" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Target</label>
          <input v-model="newExtras.svcbTarget" class="input" placeholder="." />
        </div>
        <div class="flex flex-col gap-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Params (t.ex. alpn=h2,h3)</label>
          <input v-model="newExtras.svcbParams" class="input" placeholder="alpn=h2,h3" />
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1 md:col-span-4">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Kommentar (valfri)</label>
          <textarea
            v-model="newRecord.comment"
            rows="2"
            class="input min-h-[64px]"
            placeholder="Notering om recordet (visas inte i DNS, bara internt)"
          />
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
          <template v-for="record in pagedRecords" :key="record.id">
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
                      <select v-model.number="editForm.ttl" class="input">
                        <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                      </select>
                    </div>
                    <template v-if="shouldShowContent(editForm.type)">
                      <div class="flex flex-col gap-1 md:col-span-3">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Content</label>
                        <input v-model="editForm.content" class="input" required />
                      </div>
                    </template>
                    <div v-if="editForm.type === 'MX'" class="flex flex-col gap-1 md:col-span-2">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">MX priority</label>
                      <input v-model.number="editExtras.mxPriority" class="input" type="number" min="0" placeholder="10" />
                    </div>
                    <div v-if="editForm.type === 'MX'" class="flex flex-col gap-1 md:col-span-2">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">MX host (content)</label>
                      <input v-model="editExtras.mxTarget" class="input" placeholder="mail.example.com" />
                    </div>
                    <div v-if="editForm.type === 'CAA'" class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Flag</label>
                      <input v-model.number="editExtras.caaFlag" class="input" type="number" min="0" />
                    </div>
                    <div v-if="editForm.type === 'CAA'" class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Tag</label>
                      <select v-model="editExtras.caaTag" class="input">
                        <option value="issue">issue</option>
                        <option value="issuewild">issuewild</option>
                        <option value="iodef">iodef</option>
                      </select>
                    </div>
                    <div v-if="editForm.type === 'CAA'" class="flex flex-col gap-1 md:col-span-3">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Value</label>
                      <input v-model="editExtras.caaValue" class="input" placeholder="letsencrypt.org" />
                    </div>
                    <template v-if="editForm.type === 'SRV'">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Service (_sip)</label>
                        <input v-model="editExtras.srvService" class="input" placeholder="_sip" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Proto (_tcp/_udp)</label>
                        <input v-model="editExtras.srvProto" class="input" placeholder="_tcp" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Priority</label>
                        <input v-model.number="editExtras.srvPriority" class="input" type="number" min="0" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Weight</label>
                        <input v-model.number="editExtras.srvWeight" class="input" type="number" min="0" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Port</label>
                        <input v-model.number="editExtras.srvPort" class="input" type="number" min="0" />
                      </div>
                      <div class="flex flex-col gap-1 md:col-span-2">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Target</label>
                        <input v-model="editExtras.srvTarget" class="input" placeholder="target.example.com" />
                      </div>
                    </template>
                    <template v-if="editForm.type === 'HTTPS' || editForm.type === 'SVCB'">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Priority</label>
                        <input v-model.number="editExtras.svcbPriority" class="input" type="number" min="0" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Target</label>
                        <input v-model="editExtras.svcbTarget" class="input" placeholder="." />
                      </div>
                      <div class="flex flex-col gap-1 md:col-span-3">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Params (t.ex. alpn=h2,h3)</label>
                        <input v-model="editExtras.svcbParams" class="input" placeholder="alpn=h2,h3" />
                      </div>
                    </template>
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

                    <div class="flex flex-col gap-1 md:col-span-4">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Kommentar (valfri)</label>
                      <textarea
                        v-model="editForm.comment"
                        rows="2"
                        class="input min-h-[64px]"
                        placeholder="Notering om recordet (visas inte i DNS, bara internt)"
                      />
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

    <div
      v-if="recordPageCount > 1"
      class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <span>
        Sida {{ currentRecordPage }} / {{ recordPageCount }} · visar {{ shownRecords }} av {{ totalRecords }} records
      </span>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand bg-brand text-white transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
          :class="currentRecordPage === 1 ? 'opacity-60' : ''"
          :disabled="currentRecordPage === 1"
          @click="currentRecordPage = Math.max(1, currentRecordPage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="h-4 w-4" />
        </button>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand bg-brand text-white transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
          :class="currentRecordPage === recordPageCount ? 'opacity-60' : ''"
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
    const hay = `${r.type ?? ''} ${r.name ?? ''} ${r.content ?? ''} ${r.comment ?? ''}`.toLowerCase()
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

const totalRecords = computed(() => filteredRecords.value.length)
const shownRecords = computed(() => {
  const start = (currentRecordPage.value - 1) * recordPageSize
  return Math.min(recordPageSize, Math.max(totalRecords.value - start, 0))
})

watch(
  () => searchTerm.value,
  () => {
    currentRecordPage.value = 1
  }
)

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'CAA', 'PTR', 'SPF', 'SOA', 'HTTPS', 'SVCB']

const ttlOptions = [
  { value: 1, label: 'Auto' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 h' },
  { value: 7200, label: '2 h' },
  { value: 18000, label: '5 h' },
  { value: 43200, label: '12 h' },
  { value: 86400, label: '1 dag' }
]

const typeHelp = (type: string) => {
  switch (type) {
    case 'A':
      return 'IPv4-adress (t.ex. 1.2.3.4)'
    case 'AAAA':
      return 'IPv6-adress'
    case 'CNAME':
      return 'Alias till annat namn'
    case 'MX':
      return 'Mailserver (content = host, name = subdomän), priority används'
    case 'TXT':
      return 'Textrecord, t.ex. SPF/DKIM'
    case 'SRV':
      return 'Tjänst (service/proto + prio/weight/port/target)'
    case 'CAA':
      return 'Flag/Tag/Value, t.ex. 0 issue "letsencrypt.org"'
    case 'HTTPS':
    case 'SVCB':
      return 'priority target params'
    case 'NS':
      return 'Nameserver (delegering)'
    default:
      return 'Standardinställning'
  }
}

const shouldShowContent = (type: string) => {
  return !['MX', 'CAA', 'SRV', 'HTTPS', 'SVCB'].includes(type)
}

const showCreateForm = ref(false)

const newRecord = reactive({
  type: 'A',
  name: '',
  content: '',
  ttl: 300,
  proxied: null as boolean | null,
  priority: null as number | null,
  comment: '' as string | null
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
    Object.assign(newRecord, {
      type: 'A',
      name: '',
      content: '',
      ttl: 300,
      proxied: null,
      priority: null,
      comment: ''
    })
    Object.assign(newExtras, {
      mxPriority: null,
      mxTarget: '',
      caaFlag: 0,
      caaTag: 'issue',
      caaValue: '',
      srvPriority: 0,
      srvWeight: 0,
      srvPort: 0,
      srvTarget: '',
      srvService: '',
      srvProto: 'tcp',
      svcbPriority: 0,
      svcbTarget: '',
      svcbParams: ''
    })
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
  proxied: null as boolean | null,
  priority: null as number | null,
  comment: '' as string | null
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
    proxied: record.proxied ?? null,
    priority: record.priority ?? null,
    comment: record.comment ?? ''
  })
  // reset extras when editing; user can re-apply if needed
  Object.assign(editExtras, {
    mxPriority: record.priority ?? null,
    mxTarget: '',
    caaFlag: 0,
    caaTag: 'issue',
    caaValue: '',
    srvPriority: 0,
    srvWeight: 0,
    srvPort: 0,
    srvTarget: '',
    srvService: '',
    srvProto: 'tcp',
    svcbPriority: 0,
    svcbTarget: '',
    svcbParams: ''
  })
  editing.value = true
}

const displayTtl = (ttl?: number | null) => {
  if (ttl === null || ttl === undefined) return 'auto'
  if (ttl === 1) return 'auto'
  return ttl
}

const fqdn = (name: string) => {
  if (!props.zoneName) return name
  if (!name) return props.zoneName
  return name.endsWith(props.zoneName) ? name : `${name}.${props.zoneName}`
}

const applyContentFromExtras = (form: any, extras: any) => {
  const type = form.type
  let content: string | undefined
  let priority: number | null | undefined
  if (type === 'MX') {
    content = extras.mxTarget || form.content
    priority = extras.mxPriority ?? form.priority ?? null
  } else if (type === 'CAA') {
    const flag = extras.caaFlag ?? 0
    const tag = extras.caaTag || 'issue'
    const val = extras.caaValue ?? ''
    content = `${flag} ${tag} "${val}"`
    priority = form.priority ?? null
  } else if (type === 'SRV') {
    const prio = extras.srvPriority ?? 0
    const weight = extras.srvWeight ?? 0
    const port = extras.srvPort ?? 0
    const target = extras.srvTarget ?? ''
    content = `${prio} ${weight} ${port} ${target}`
    priority = null
  } else if (type === 'HTTPS' || type === 'SVCB') {
    const prio = extras.svcbPriority ?? 0
    const target = extras.svcbTarget ?? '.'
    const params = extras.svcbParams ? ` ${extras.svcbParams}` : ''
    content = `${prio} ${target}${params}`
    priority = null
  }
  if (content !== undefined) form.content = content
  if (priority !== undefined) form.priority = priority
}

const newExtras = reactive({
  mxPriority: null as number | null,
  mxTarget: '',
  caaFlag: 0,
  caaTag: 'issue',
  caaValue: '',
  srvPriority: 0,
  srvWeight: 0,
  srvPort: 0,
  srvTarget: '',
  srvService: '',
  srvProto: 'tcp',
  svcbPriority: 0,
  svcbTarget: '',
  svcbParams: ''
})

const editExtras = reactive({
  mxPriority: null as number | null,
  mxTarget: '',
  caaFlag: 0,
  caaTag: 'issue',
  caaValue: '',
  srvPriority: 0,
  srvWeight: 0,
  srvPort: 0,
  srvTarget: '',
  srvService: '',
  srvProto: 'tcp',
  svcbPriority: 0,
  svcbTarget: '',
  svcbParams: ''
})

watch(
  () => [newRecord.type, { ...newExtras }],
  () => applyContentFromExtras(newRecord, newExtras),
  { deep: true }
)

watch(
  () => [editForm.type, { ...editExtras }],
  () => applyContentFromExtras(editForm, editExtras),
  { deep: true }
)

const previewLine = (form: any) => {
  const domain = fqdn(form.name)
  const target = form.content || '(saknar content)'
  const base = `${domain || '(saknar namn)'} points to ${target}`
  const proxiedSuffix =
    form.proxied === true ? ' and has its traffic proxied through Cloudflare.' : '.'

  return `${base}${proxiedSuffix}`
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


