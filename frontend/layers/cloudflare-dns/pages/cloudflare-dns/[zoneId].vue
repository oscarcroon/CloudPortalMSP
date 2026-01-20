<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ t('cloudflareDns.zone.label') }}
      </p>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
            <span v-if="zonePending" class="inline-flex items-center gap-2 text-base text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              {{ t('cloudflareDns.zone.loadingZone') }}
            </span>
            <span v-else>{{ zoneData?.zone?.name ?? '—' }}</span>
          </h1>
          <NuxtLink
            to="/cloudflare-dns"
            class="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Icon icon="mdi:arrow-left" class="h-4 w-4" />
            {{ t('cloudflareDns.zone.back') }}
          </NuxtLink>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <template v-if="zonePending">
            <span class="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              {{ t('cloudflareDns.zone.loadingStatus') }}
            </span>
          </template>
          <template v-else>
            {{ t('cloudflareDns.zone.statusLine', { status: zoneData?.zone?.status ?? t('cloudflareDns.zone.unknown'), plan: zoneData?.zone?.plan ?? t('cloudflareDns.zone.unknown') }) }}
          </template>
        </p>
        <div class="flex items-center gap-2">
          <span class="mod-cloudflare-dns-badge">
            <Icon icon="mdi:shield-check-outline" class="h-4 w-4" />
            <template v-if="zonePending">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
            </template>
            <template v-else>
              {{ zoneData?.access?.zoneRole ?? 'inherit' }}
            </template>
          </span>
        </div>
      </div>
    </header>

    <div
      v-if="!zonePending && isPending(zoneData?.zone?.status)"
      class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div class="flex items-start gap-2">
        <Icon icon="mdi:alert" class="mt-0.5 h-4 w-4" />
        <div class="space-y-2">
          <p class="font-semibold">{{ t('cloudflareDns.zone.pending.title') }}</p>
          <p>{{ t('cloudflareDns.zone.pending.description') }}</p>
          <p class="text-xs text-amber-700/90 dark:text-amber-100/90">
            {{ t('cloudflareDns.zone.pending.propagation') }}
          </p>
          <div v-if="zoneData?.zone?.nameServers?.length" class="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-amber-800 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-100">
            <p class="text-xs font-semibold">{{ t('cloudflareDns.zone.pending.pointTo') }}</p>
            <ul class="mt-1 list-disc pl-4 text-xs">
              <li v-for="ns in zoneData.zone.nameServers" :key="ns" class="font-mono text-[12px]">{{ ns }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <CloudflareZoneRecordsTable
      v-if="zoneId && recordsData?.records"
      :zone-id="zoneId"
      :zone-name="zoneData?.zone?.name ?? ''"
      :records="recordsData.records"
      :can-edit="recordsData.access?.canEditRecords ?? false"
      @refresh="refreshRecords"
    />

    <CloudflareAclEditor
      v-if="zoneId && zoneData?.access?.canManageAcls"
      :zone-id="zoneId"
      :entries="aclData?.entries ?? []"
      :can-manage="true"
      @refreshed="refreshAcl"
    />

    <section
      v-if="zoneId && zoneData?.access?.canManageZones"
      class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm dark:border-red-700 dark:bg-red-900/30 dark:text-red-100"
    >
      <header class="mb-2 flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide">{{ t('cloudflareDns.zone.danger.label') }}</p>
          <p class="text-sm font-semibold">{{ t('cloudflareDns.zone.danger.title') }}</p>
          <p class="text-xs text-red-700/90 dark:text-red-100/80">
            {{ t('cloudflareDns.zone.danger.description') }}
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
          type="button"
          :disabled="deleting"
          @click="openDeleteModal"
        >
          <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
          {{ t('cloudflareDns.zone.danger.deleteAction') }}
        </button>
      </header>
      <p v-if="deleteError" class="text-xs text-red-700 dark:text-red-200">{{ deleteError }}</p>
    </section>

    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl dark:border-red-700 dark:bg-slate-900">
          <header class="mb-4 space-y-1">
            <p class="text-xs uppercase tracking-wide text-red-600 dark:text-red-200">
              {{ t('cloudflareDns.zone.delete.confirmLabel') }}
            </p>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {{ t('cloudflareDns.zone.delete.confirmTitle') }}
            </h3>
            <p class="text-sm text-slate-700 dark:text-slate-200">
              {{ t('cloudflareDns.zone.delete.confirmDescription') }}
            </p>
          </header>
          <div class="space-y-3">
            <div class="text-sm text-slate-700 dark:text-slate-200">
              <p>{{ t('cloudflareDns.zone.delete.enterName') }}</p>
              <input
                v-model="confirmName"
                class="input mt-1"
                type="text"
                :placeholder="zoneData?.zone?.name ?? ''"
              />
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input v-model="confirmAck" type="checkbox" />
              <span>{{ t('cloudflareDns.zone.delete.ack') }}</span>
            </label>
            <p v-if="deleteError" class="text-xs text-red-700 dark:text-red-200">{{ deleteError }}</p>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button class="btn-secondary" type="button" @click="closeDeleteModal">
              {{ t('common.cancel') }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              :disabled="deleting || !canDeleteConfirmed"
              @click="confirmDeleteZone"
            >
              <Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
              {{ t('cloudflareDns.zone.danger.deleteAction') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareZoneRecordsTable from '@cloudflare-dns/components/CloudflareZoneRecordsTable.vue'
import CloudflareAclEditor from '@cloudflare-dns/components/CloudflareAclEditor.vue'
import { useRouter } from '#app'
import { useI18n } from '#imports'
import { useEntityNames } from '~/composables/useEntityNames'

const route = useRoute()
const zoneId = computed(() => route.params.zoneId as string)
const router = useRouter()
const { t } = useI18n()
const entityNames = useEntityNames()

const { data: zoneData, refresh: refreshZone, pending: zonePending } = useAsyncData(
  () => $fetch(`/api/dns/cloudflare/zones/${zoneId.value}`),
  { watch: [zoneId] }
)

const { data: recordsData, refresh: refreshRecords } = useAsyncData(
  () => $fetch(`/api/dns/cloudflare/zones/${zoneId.value}/records`),
  { watch: [zoneId] }
)

const { data: aclData, refresh: refreshAcl } = useAsyncData(
  () =>
    zoneData.value?.access?.canManageAcls
      ? $fetch(`/api/dns/cloudflare/zones/${zoneId.value}/acl`)
      : Promise.resolve({ entries: [] }),
  {
    watch: [zoneData, zoneId],
    key: computed(() => `cloudflare-acl-${zoneId.value}`)
  }
)

// Cache zone name for breadcrumbs
watch(zoneData, (value) => {
  if (value?.zone?.id && value?.zone?.name) {
    entityNames.setName('zone', value.zone.id, value.zone.name)
  }
}, { immediate: true })

watch(zoneData, async (value) => {
  if (value?.access?.canManageAcls) {
    await refreshAcl()
  }
})

const refreshAll = async () => {
  await Promise.all([refreshZone(), refreshRecords(), refreshAcl()])
}

const isPending = (status?: string | null) => {
  if (!status) return false
  return status.toLowerCase().includes('pending')
}

const deleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteModal = ref(false)
const confirmName = ref('')
const confirmAck = ref(false)

const canDeleteConfirmed = computed(() => {
  const expected = zoneData.value?.zone?.name?.trim().toLowerCase() ?? ''
  return confirmAck.value && confirmName.value.trim().toLowerCase() === expected && expected.length > 0
})

const openDeleteModal = () => {
  showDeleteModal.value = true
  confirmName.value = ''
  confirmAck.value = false
  deleteError.value = null
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  confirmName.value = ''
  confirmAck.value = false
  deleteError.value = null
}

const confirmDeleteZone = async () => {
  if (!zoneId.value || !canDeleteConfirmed.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await $fetch(`/api/dns/cloudflare/zones/${zoneId.value}`, { method: 'DELETE' })
    closeDeleteModal()
    await router.push('/cloudflare-dns')
  } catch (err: any) {
    deleteError.value = err?.data?.message ?? err?.message ?? 'Kunde inte ta bort zonen.'
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void refreshAll()
})
</script>


