<template>
  <section class="mod-windows-dns-panel space-y-4">
    <header class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ $t('windowsDns.records.label') }}
          </p>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ $t('windowsDns.records.title', { zoneName }) }}
          </h3>
        </div>
        <div class="relative w-full max-w-xs">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchTerm"
            type="search"
            :placeholder="$t('windowsDns.records.searchPlaceholder')"
            class="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      </div>
      <div class="flex items-center justify-between">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.records.showing', { shown: pagedRecords.length, total: filteredRecords.length }) }}
        </p>
        <div v-if="canEdit" class="flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
            @click="showCreateForm = !showCreateForm"
          >
            <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
            {{ showCreateForm ? $t('windowsDns.records.cancel') : $t('windowsDns.records.addRecord') }}
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
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.type') }}</label>
          <select v-model="newRecord.type" class="input" required @change="onTypeChange('create')">
            <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.name') }}</label>
          <input v-model="newRecord.name" class="input" required placeholder="@" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.ttl') }}</label>
          <select v-model.number="newRecord.ttl" class="input">
            <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- Type-specific fields for CREATE -->
      <template v-if="isSimpleType(newRecord.type)">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1 md:col-span-4">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ getContentLabel(newRecord.type) }}</label>
            <input v-model="newRecord.content" class="input" required :placeholder="getContentPlaceholder(newRecord.type)" />
          </div>
        </div>
      </template>

      <!-- MX fields -->
      <template v-else-if="newRecord.type === 'MX'">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.priority') }}</label>
            <input v-model.number="newRecord.mxPriority" type="number" min="0" max="65535" class="input" required placeholder="10" />
          </div>
          <div class="flex flex-col gap-1 md:col-span-3">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.mailServer') }}</label>
            <input v-model="newRecord.mxExchange" class="input" required placeholder="mail.example.com" />
          </div>
        </div>
      </template>

      <!-- SRV fields -->
      <template v-else-if="newRecord.type === 'SRV'">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.priority') }}</label>
            <input v-model.number="newRecord.srvPriority" type="number" min="0" max="65535" class="input" required placeholder="10" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.weight') }}</label>
            <input v-model.number="newRecord.srvWeight" type="number" min="0" max="65535" class="input" required placeholder="5" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.port') }}</label>
            <input v-model.number="newRecord.srvPort" type="number" min="0" max="65535" class="input" required placeholder="443" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.target') }}</label>
            <input v-model="newRecord.srvTarget" class="input" required placeholder="server.example.com" />
          </div>
        </div>
      </template>

      <!-- CAA fields -->
      <template v-else-if="newRecord.type === 'CAA'">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.flags') }}</label>
            <input v-model.number="newRecord.caaFlags" type="number" min="0" max="255" class="input" required placeholder="0" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.tag') }}</label>
            <select v-model="newRecord.caaTag" class="input" required>
              <option value="issue">issue</option>
              <option value="issuewild">issuewild</option>
              <option value="iodef">iodef</option>
            </select>
          </div>
          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.value') }}</label>
            <input v-model="newRecord.caaValue" class="input" required placeholder="letsencrypt.org" />
          </div>
        </div>
      </template>

      <!-- TLSA fields -->
      <template v-else-if="newRecord.type === 'TLSA'">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.usage') }}</label>
            <select v-model.number="newRecord.tlsaUsage" class="input" required>
              <option :value="0">0 - PKIX-TA</option>
              <option :value="1">1 - PKIX-EE</option>
              <option :value="2">2 - DANE-TA</option>
              <option :value="3">3 - DANE-EE</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.selector') }}</label>
            <select v-model.number="newRecord.tlsaSelector" class="input" required>
              <option :value="0">0 - Full cert</option>
              <option :value="1">1 - SubjectPublicKeyInfo</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.matchingType') }}</label>
            <select v-model.number="newRecord.tlsaMatchingType" class="input" required>
              <option :value="0">0 - Full</option>
              <option :value="1">1 - SHA-256</option>
              <option :value="2">2 - SHA-512</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.certificateData') }}</label>
            <input v-model="newRecord.tlsaCertData" class="input font-mono text-xs" required placeholder="abc123..." />
          </div>
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="flex flex-col gap-1 md:col-span-4">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.comment') }}</label>
          <textarea
            v-model="newRecord.comment"
            rows="2"
            class="input min-h-[64px]"
            :placeholder="$t('windowsDns.records.fields.commentPlaceholder')"
          />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn-secondary"
          @click="showCreateForm = false"
        >
          {{ $t('windowsDns.records.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="creating"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          {{ $t('windowsDns.records.addRecord') }}
        </button>
      </div>
      <p v-if="createError" class="text-xs text-red-600 dark:text-red-400">{{ createError }}</p>
    </form>

    <!-- Records table -->
    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-800/40">
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <th class="px-4 py-2">{{ $t('windowsDns.records.table.type') }}</th>
            <th class="px-4 py-2">{{ $t('windowsDns.records.table.name') }}</th>
            <th class="px-4 py-2">{{ $t('windowsDns.records.table.content') }}</th>
            <th class="px-4 py-2">{{ $t('windowsDns.records.table.ttl') }}</th>
            <th v-if="canEdit" class="px-4 py-2 text-right">{{ $t('windowsDns.records.table.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          <tr v-if="pagedRecords.length === 0">
            <td :colspan="canEdit ? 5 : 4" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ searchTerm ? $t('windowsDns.records.noRecordsFoundWithSearch', { searchTerm }) : $t('windowsDns.records.noRecordsFound') }}
            </td>
          </tr>
          <template v-for="record in pagedRecords" :key="record.id || record.name + record.type">
            <tr class="text-sm text-slate-700 dark:text-slate-200">
              <td class="px-4 py-3 align-top">
                <span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                  {{ record.type }}
                </span>
              </td>
              <td class="px-4 py-3 align-top font-mono text-sm">
                <div class="flex items-center gap-1">
                  <span>{{ record.name || '@' }}</span>
                  <span
                    v-if="record.comment"
                    class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    :title="record.comment"
                  >
                    <Icon icon="mdi:comment-text-outline" class="h-3 w-3" />
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 align-top break-all">
                <span v-html="formatRecordContent(record)"></span>
              </td>
              <td class="px-4 py-3 align-top">{{ displayTtl(record.ttl) }}</td>
              <td v-if="canEdit" class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
                    type="button"
                    :title="$t('windowsDns.records.edit')"
                    @click="startEdit(record)"
                  >
                    <Icon icon="mdi:pencil" class="h-4 w-4" />
                  </button>
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:border-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 dark:border-red-700 dark:text-red-400"
                    type="button"
                    :title="$t('windowsDns.records.delete')"
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
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.type') }}</label>
                      <select v-model="editForm.type" class="input" required @change="onTypeChange('edit')">
                        <option v-for="t in recordTypes" :key="t" :value="t">{{ t }}</option>
                      </select>
                    </div>
                    <div class="flex flex-col gap-1 md:col-span-2">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.name') }}</label>
                      <input v-model="editForm.name" class="input" required />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.ttl') }}</label>
                      <select v-model.number="editForm.ttl" class="input">
                        <option v-for="opt in ttlOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                      </select>
                    </div>
                  </div>

                  <!-- Type-specific fields for EDIT -->
                  <template v-if="isSimpleType(editForm.type)">
                    <div class="grid gap-3 md:grid-cols-4">
                      <div class="flex flex-col gap-1 md:col-span-4">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ getContentLabel(editForm.type) }}</label>
                        <input v-model="editForm.content" class="input" required :placeholder="getContentPlaceholder(editForm.type)" />
                      </div>
                    </div>
                  </template>

                  <!-- MX fields -->
                  <template v-else-if="editForm.type === 'MX'">
                    <div class="grid gap-3 md:grid-cols-4">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.priority') }}</label>
                        <input v-model.number="editForm.mxPriority" type="number" min="0" max="65535" class="input" required placeholder="10" />
                      </div>
                      <div class="flex flex-col gap-1 md:col-span-3">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.mailServer') }}</label>
                        <input v-model="editForm.mxExchange" class="input" required placeholder="mail.example.com" />
                      </div>
                    </div>
                  </template>

                  <!-- SRV fields -->
                  <template v-else-if="editForm.type === 'SRV'">
                    <div class="grid gap-3 md:grid-cols-4">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.priority') }}</label>
                        <input v-model.number="editForm.srvPriority" type="number" min="0" max="65535" class="input" required placeholder="10" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.weight') }}</label>
                        <input v-model.number="editForm.srvWeight" type="number" min="0" max="65535" class="input" required placeholder="5" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.port') }}</label>
                        <input v-model.number="editForm.srvPort" type="number" min="0" max="65535" class="input" required placeholder="443" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.target') }}</label>
                        <input v-model="editForm.srvTarget" class="input" required placeholder="server.example.com" />
                      </div>
                    </div>
                  </template>

                  <!-- CAA fields -->
                  <template v-else-if="editForm.type === 'CAA'">
                    <div class="grid gap-3 md:grid-cols-4">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.flags') }}</label>
                        <input v-model.number="editForm.caaFlags" type="number" min="0" max="255" class="input" required placeholder="0" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.tag') }}</label>
                        <select v-model="editForm.caaTag" class="input" required>
                          <option value="issue">issue</option>
                          <option value="issuewild">issuewild</option>
                          <option value="iodef">iodef</option>
                        </select>
                      </div>
                      <div class="flex flex-col gap-1 md:col-span-2">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.value') }}</label>
                        <input v-model="editForm.caaValue" class="input" required placeholder="letsencrypt.org" />
                      </div>
                    </div>
                  </template>

                  <!-- TLSA fields -->
                  <template v-else-if="editForm.type === 'TLSA'">
                    <div class="grid gap-3 md:grid-cols-4">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.usage') }}</label>
                        <select v-model.number="editForm.tlsaUsage" class="input" required>
                          <option :value="0">0 - PKIX-TA</option>
                          <option :value="1">1 - PKIX-EE</option>
                          <option :value="2">2 - DANE-TA</option>
                          <option :value="3">3 - DANE-EE</option>
                        </select>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.selector') }}</label>
                        <select v-model.number="editForm.tlsaSelector" class="input" required>
                          <option :value="0">0 - Full cert</option>
                          <option :value="1">1 - SubjectPublicKeyInfo</option>
                        </select>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.matchingType') }}</label>
                        <select v-model.number="editForm.tlsaMatchingType" class="input" required>
                          <option :value="0">0 - Full</option>
                          <option :value="1">1 - SHA-256</option>
                          <option :value="2">2 - SHA-512</option>
                        </select>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.certificateData') }}</label>
                        <input v-model="editForm.tlsaCertData" class="input font-mono text-xs" required placeholder="abc123..." />
                      </div>
                    </div>
                  </template>

                  <div class="grid gap-3 md:grid-cols-4">
                    <div class="flex flex-col gap-1 md:col-span-4">
                      <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('windowsDns.records.fields.comment') }}</label>
                      <textarea
                        v-model="editForm.comment"
                        rows="2"
                        class="input min-h-[64px]"
                        :placeholder="$t('windowsDns.records.fields.commentPlaceholder')"
                      />
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button type="button" class="btn-secondary" @click="cancelEdit">
                      {{ $t('windowsDns.records.cancel') }}
                    </button>
                    <button
                      type="submit"
                      :disabled="updating"
                      class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
                    >
                      <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                      {{ $t('windowsDns.records.save') }}
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
        {{ $t('windowsDns.records.pagination', { page: currentRecordPage, pages: recordPageCount }) }}
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
    const hay = `${r.type ?? ''} ${r.name ?? ''} ${r.content ?? ''} ${r.value ?? ''} ${r.data ?? ''} ${r.comment ?? ''}`.toLowerCase()
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

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR', 'CAA', 'TLSA']

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

// Helper functions for type-specific handling
const isSimpleType = (type: string) => ['A', 'AAAA', 'CNAME', 'TXT', 'NS', 'PTR'].includes(type)

const getContentLabel = (type: string) => {
  const { $i18n } = useNuxtApp()
  const key = `windowsDns.records.contentLabels.${type.toLowerCase()}`
  return $i18n.te(key) ? $i18n.t(key) : $i18n.t('windowsDns.records.fields.content')
}

const getContentPlaceholder = (type: string) => {
  const { $i18n } = useNuxtApp()
  const key = `windowsDns.records.contentPlaceholders.${type.toLowerCase()}`
  return $i18n.te(key) ? $i18n.t(key) : ''
}

// Format record content for display
const formatRecordContent = (record: any) => {
  const content = record.content || record.value || record.data || ''
  const type = record.type?.toUpperCase()

  switch (type) {
    case 'MX': {
      const parts = content.split(/\s+/)
      if (parts.length >= 2) {
        return `<span class="text-slate-500">${parts[0]}</span> ${parts.slice(1).join(' ')}`
      }
      return content
    }
    case 'SRV': {
      const parts = content.split(/\s+/)
      if (parts.length >= 4) {
        return `<span class="text-slate-500">${parts[0]} ${parts[1]} ${parts[2]}</span> ${parts.slice(3).join(' ')}`
      }
      return content
    }
    case 'CAA': {
      const parts = content.split(/\s+/)
      if (parts.length >= 3) {
        return `<span class="text-slate-500">${parts[0]}</span> <span class="font-medium">${parts[1]}</span> ${parts.slice(2).join(' ')}`
      }
      return content
    }
    case 'TLSA': {
      const parts = content.split(/\s+/)
      if (parts.length >= 4) {
        const certData = parts.slice(3).join('')
        const truncated = certData.length > 20 ? certData.slice(0, 20) + '...' : certData
        return `<span class="text-slate-500">${parts[0]}/${parts[1]}/${parts[2]}</span> <span class="font-mono text-xs">${truncated}</span>`
      }
      return content
    }
    default:
      return content
  }
}

// Build content string from type-specific fields
const buildContent = (form: any) => {
  switch (form.type) {
    case 'MX':
      return `${form.mxPriority ?? 10} ${form.mxExchange ?? ''}`
    case 'SRV':
      return `${form.srvPriority ?? 0} ${form.srvWeight ?? 0} ${form.srvPort ?? 0} ${form.srvTarget ?? ''}`
    case 'CAA':
      return `${form.caaFlags ?? 0} ${form.caaTag ?? 'issue'} ${form.caaValue ?? ''}`
    case 'TLSA':
      return `${form.tlsaUsage ?? 3} ${form.tlsaSelector ?? 1} ${form.tlsaMatchingType ?? 1} ${form.tlsaCertData ?? ''}`
    default:
      return form.content ?? ''
  }
}

// Parse content string into type-specific fields
const parseContent = (type: string, content: string) => {
  const parts = content.split(/\s+/)
  switch (type) {
    case 'MX':
      return {
        mxPriority: parseInt(parts[0], 10) || 10,
        mxExchange: parts.slice(1).join(' ') || ''
      }
    case 'SRV':
      return {
        srvPriority: parseInt(parts[0], 10) || 0,
        srvWeight: parseInt(parts[1], 10) || 0,
        srvPort: parseInt(parts[2], 10) || 0,
        srvTarget: parts.slice(3).join(' ') || ''
      }
    case 'CAA':
      return {
        caaFlags: parseInt(parts[0], 10) || 0,
        caaTag: parts[1] || 'issue',
        caaValue: parts.slice(2).join(' ').replace(/^"|"$/g, '') || ''
      }
    case 'TLSA':
      return {
        tlsaUsage: parseInt(parts[0], 10) || 3,
        tlsaSelector: parseInt(parts[1], 10) || 1,
        tlsaMatchingType: parseInt(parts[2], 10) || 1,
        tlsaCertData: parts.slice(3).join('') || ''
      }
    default:
      return {}
  }
}

// Create form
const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const newRecord = reactive({
  type: 'A',
  name: '@',
  content: '',
  ttl: 3600,
  comment: '',
  // MX fields
  mxPriority: 10,
  mxExchange: '',
  // SRV fields
  srvPriority: 0,
  srvWeight: 0,
  srvPort: 443,
  srvTarget: '',
  // CAA fields
  caaFlags: 0,
  caaTag: 'issue',
  caaValue: '',
  // TLSA fields
  tlsaUsage: 3,
  tlsaSelector: 1,
  tlsaMatchingType: 1,
  tlsaCertData: ''
})

const onTypeChange = (mode: 'create' | 'edit') => {
  // Reset type-specific fields when type changes
  if (mode === 'create') {
    newRecord.content = ''
    newRecord.mxPriority = 10
    newRecord.mxExchange = ''
    newRecord.srvPriority = 0
    newRecord.srvWeight = 0
    newRecord.srvPort = 443
    newRecord.srvTarget = ''
    newRecord.caaFlags = 0
    newRecord.caaTag = 'issue'
    newRecord.caaValue = ''
    newRecord.tlsaUsage = 3
    newRecord.tlsaSelector = 1
    newRecord.tlsaMatchingType = 1
    newRecord.tlsaCertData = ''
  }
}

const createRecord = async () => {
  creating.value = true
  createError.value = null
  try {
    const content = isSimpleType(newRecord.type) ? newRecord.content : buildContent(newRecord)
    const payload: any = {
      type: newRecord.type,
      name: newRecord.name,
      content,
      ttl: newRecord.ttl
    }
    // For MX, also send priority separately (backend may use it)
    if (newRecord.type === 'MX') {
      payload.priority = newRecord.mxPriority
    }
    // Only include comment if it has a value
    if (newRecord.comment && newRecord.comment.trim()) {
      payload.comment = newRecord.comment.trim()
    }

    await $fetch(`/api/dns/windows/zones/${props.zoneId}/records`, {
      method: 'POST',
      body: payload
    })
    // Reset form
    Object.assign(newRecord, {
      type: 'A',
      name: '@',
      content: '',
      ttl: 3600,
      comment: '',
      mxPriority: 10,
      mxExchange: '',
      srvPriority: 0,
      srvWeight: 0,
      srvPort: 443,
      srvTarget: '',
      caaFlags: 0,
      caaTag: 'issue',
      caaValue: '',
      tlsaUsage: 3,
      tlsaSelector: 1,
      tlsaMatchingType: 1,
      tlsaCertData: ''
    })
    showCreateForm.value = false
    emit('refresh')
  } catch (err: any) {
    const { $i18n } = useNuxtApp()
    createError.value = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.records.createError')
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
  comment: '',
  originalRecord: null as any,
  // MX fields
  mxPriority: 10,
  mxExchange: '',
  // SRV fields
  srvPriority: 0,
  srvWeight: 0,
  srvPort: 443,
  srvTarget: '',
  // CAA fields
  caaFlags: 0,
  caaTag: 'issue',
  caaValue: '',
  // TLSA fields
  tlsaUsage: 3,
  tlsaSelector: 1,
  tlsaMatchingType: 1,
  tlsaCertData: ''
})

const startEdit = (record: any) => {
  editingId.value = record.id || record.name + record.type
  const content = record.content || record.value || record.data || ''
  const parsed = parseContent(record.type, content)

  Object.assign(editForm, {
    type: record.type,
    name: record.name || '@',
    content: isSimpleType(record.type) ? content : '',
    ttl: record.ttl ?? 3600,
    comment: record.comment ?? '',
    originalRecord: record,
    // Reset all type-specific fields first
    mxPriority: 10,
    mxExchange: '',
    srvPriority: 0,
    srvWeight: 0,
    srvPort: 443,
    srvTarget: '',
    caaFlags: 0,
    caaTag: 'issue',
    caaValue: '',
    tlsaUsage: 3,
    tlsaSelector: 1,
    tlsaMatchingType: 1,
    tlsaCertData: '',
    // Then apply parsed values
    ...parsed
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
    const recordId = editForm.originalRecord?.id
    if (!recordId) {
      const { $i18n } = useNuxtApp()
      updateError.value = $i18n.t('windowsDns.records.missingRecordId')
      return
    }

    // Build content from type-specific fields
    const newContent = isSimpleType(editForm.type) ? editForm.content : buildContent(editForm)

    // Build payload with only changed fields
    const payload: Record<string, unknown> = {}
    if (editForm.type !== editForm.originalRecord?.type) payload.type = editForm.type
    if (editForm.name !== (editForm.originalRecord?.name || '@')) payload.name = editForm.name

    const origContent = editForm.originalRecord?.content || editForm.originalRecord?.value || editForm.originalRecord?.data || ''
    if (newContent !== origContent) payload.content = newContent
    if (editForm.ttl !== (editForm.originalRecord?.ttl ?? 3600)) payload.ttl = editForm.ttl

    // Comment: only send if changed (empty string = delete comment)
    const origComment = editForm.originalRecord?.comment ?? ''
    if (editForm.comment !== origComment) {
      // Send null if empty (to delete), otherwise send the trimmed value
      payload.comment = editForm.comment?.trim() || null
    }

    await $fetch(`/api/dns/windows/zones/${props.zoneId}/records/${recordId}`, {
      method: 'PATCH',
      body: payload
    })
    cancelEdit()
    emit('refresh')
  } catch (err: any) {
    const { $i18n } = useNuxtApp()
    updateError.value = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.records.updateError')
  } finally {
    updating.value = false
  }
}

const deleteRecord = async (record: any) => {
  const { $i18n } = useNuxtApp()
  const confirmMessage = $i18n.t('windowsDns.records.deleteConfirm', { type: record.type, name: record.name || '@' })
  if (!confirm(confirmMessage)) return
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
    const errorMessage = err?.data?.message ?? err?.message ?? $i18n.t('windowsDns.records.deleteError')
    alert(errorMessage)
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
