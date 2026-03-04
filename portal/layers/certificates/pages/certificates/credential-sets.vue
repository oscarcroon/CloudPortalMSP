<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <NuxtLink to="/certificates" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
          <Icon icon="mdi:arrow-left" class="h-4 w-4" />
          {{ $t('certificates.title') }}
        </NuxtLink>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('certificates.credentialSets.title') }}
        </h1>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px]"
        @click="showCreate = true"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ $t('certificates.credentialSets.create') }}
      </button>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.common.loading') }}</div>

    <div v-else-if="credentialSets.length === 0" class="mod-certificates-panel text-center py-12">
      <Icon icon="mdi:key-outline" class="mx-auto h-12 w-12 text-slate-300" />
      <p class="mt-4 text-sm text-slate-500">{{ $t('certificates.common.noData') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="cs in credentialSets"
        :key="cs.id"
        class="mod-certificates-panel flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-slate-900 dark:text-slate-50">{{ cs.name }}</h3>
            <CertStatusBadge v-if="cs.isDefault" status="active" />
            <CertStatusBadge v-if="!cs.isActive" status="inactive" />
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ $t(`certificates.credentialSets.providers.${cs.provider}`) }} · {{ cs.acmeDirectoryUrl }}
          </p>
          <p v-if="cs.eabKid" class="text-xs text-slate-500 dark:text-slate-400">
            EAB KID: {{ cs.eabKid }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
            @click="openEdit(cs)"
          >
            <Icon icon="mdi:pencil-outline" class="h-3.5 w-3.5" />
            {{ $t('certificates.common.edit') }}
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            @click="confirmDelete(cs)"
          >
            <Icon icon="mdi:trash-can-outline" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit modal -->
    <CertCredentialSetForm
      :is-open="showCreate || !!editingItem"
      :credential-set="editingItem"
      @close="showCreate = false; editingItem = null"
      @saved="handleSaved"
    />

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div
        v-if="deletingItem"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
        @click.self="deletingItem = null"
      >
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.credentialSets.delete') }}</h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.credentialSets.deleteConfirm') }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
              @click="deletingItem = null"
            >
              {{ $t('certificates.common.cancel') }}
            </button>
            <button
              class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
              :disabled="deleteLoading"
              @click="handleDelete"
            >
              {{ $t('certificates.common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertStatusBadge from '../../components/CertStatusBadge.vue'
import CertCredentialSetForm from '../../components/CertCredentialSetForm.vue'

const credentialSets = ref<any[]>([])
const loading = ref(true)
const showCreate = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const deleteLoading = ref(false)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/certificates/credential-sets')
    credentialSets.value = res.credentialSets ?? []
  } catch { /* handled by empty state */ }
  finally { loading.value = false }
}

const openEdit = (cs: any) => { editingItem.value = cs }

const confirmDelete = (cs: any) => { deletingItem.value = cs }

const handleDelete = async () => {
  if (!deletingItem.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/certificates/credential-sets/${deletingItem.value.id}`, { method: 'DELETE' })
    deletingItem.value = null
    await fetchData()
  } catch (err: any) {
    alert(err?.data?.message ?? 'Failed to delete')
  } finally {
    deleteLoading.value = false
  }
}

const handleSaved = () => {
  showCreate.value = false
  editingItem.value = null
  fetchData()
}

onMounted(() => fetchData())
</script>
