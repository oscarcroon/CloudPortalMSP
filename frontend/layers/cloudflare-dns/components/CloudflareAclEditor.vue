<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ t('cloudflareDns.acl.label') }}
        </p>
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {{ t('cloudflareDns.acl.title') }}
        </h3>
      </div>
      <span v-if="!canManage" class="text-xs text-slate-500 dark:text-slate-400">
        {{ t('cloudflareDns.acl.readOnly') }}
      </span>
    </header>

    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-800/40">
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <th class="px-4 py-2">{{ t('cloudflareDns.acl.principal') }}</th>
            <th class="px-4 py-2">{{ t('cloudflareDns.acl.type') }}</th>
            <th class="px-4 py-2">{{ t('cloudflareDns.acl.role') }}</th>
            <th v-if="canManage" class="px-4 py-2 text-right">{{ t('cloudflareDns.acl.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          <tr v-for="(row, index) in localRows" :key="`${row.principalId}-${index}`" class="text-sm text-slate-700 dark:text-slate-200">
            <td class="px-4 py-3 align-top">
              <input
                v-model="row.principalId"
                class="input"
                :disabled="!canManage"
                :placeholder="t('cloudflareDns.acl.principalPlaceholder')"
              />
            </td>
            <td class="px-4 py-3 align-top">
              <select v-model="row.principalType" class="input" :disabled="!canManage">
                <option value="user">{{ t('cloudflareDns.acl.principalType.user') }}</option>
                <option value="org-role">{{ t('cloudflareDns.acl.principalType.orgRole') }}</option>
              </select>
            </td>
            <td class="px-4 py-3 align-top">
              <select v-model="row.role" class="input" :disabled="!canManage">
                <option value="viewer">{{ t('cloudflareDns.acl.roleOptions.viewer') }}</option>
                <option value="records-only">{{ t('cloudflareDns.acl.roleOptions.recordsOnly') }}</option>
                <option value="editor">{{ t('cloudflareDns.acl.roleOptions.editor') }}</option>
                <option value="admin">{{ t('cloudflareDns.acl.roleOptions.admin') }}</option>
              </select>
            </td>
            <td v-if="canManage" class="px-4 py-3 text-right">
              <button class="btn-danger" type="button" @click="removeRow(index)">
                {{ t('cloudflareDns.acl.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="canManage" class="flex items-center justify-between">
      <button class="btn-secondary" type="button" @click="addRow">
        {{ t('cloudflareDns.acl.addRow') }}
      </button>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
        type="button"
        :disabled="saving"
        @click="save"
      >
        <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
        {{ t('cloudflareDns.acl.save') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from '#imports'

const props = defineProps<{
  zoneId: string
  entries: {
    principalType: 'user' | 'org-role'
    principalId: string
    role: 'viewer' | 'records-only' | 'editor' | 'admin'
  }[]
  canManage: boolean
}>()

const emit = defineEmits<{ refreshed: [] }>()

const { t } = useI18n()

const localRows = ref(
  props.entries?.length
    ? props.entries.map((e) => ({ ...e }))
    : [
        {
          principalType: 'org-role' as const,
          principalId: 'admin',
          role: 'admin' as const
        }
      ]
)

watch(
  () => props.entries,
  (next) => {
    localRows.value = next?.map((e) => ({ ...e })) ?? []
  }
)

const addRow = () => {
  localRows.value.push({
    principalType: 'user',
    principalId: '',
    role: 'viewer'
  })
}

const removeRow = (index: number) => {
  localRows.value.splice(index, 1)
}

const saving = ref(false)

const save = async () => {
  saving.value = true
  try {
    await $fetch(`/api/dns/cloudflare/zones/${props.zoneId}/acl`, {
      method: 'PUT',
      body: { entries: localRows.value }
    })
    emit('refreshed')
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte spara ACL', error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.input {
  @apply w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50;
}
.btn-secondary {
  @apply inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100;
}
.btn-danger {
  @apply inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 dark:border-red-700 dark:text-red-400;
}
</style>


